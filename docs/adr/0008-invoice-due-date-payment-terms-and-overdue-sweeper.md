# ADR-0008: Invoice Due Date, Payment Terms ราย `Property` และ Overdue Background Sweeper

## Status

Accepted — 2026-11-10

## Context

ใบแจ้งหนี้รายเดือนต้องมีกำหนดชำระ (`DueDate`) เพื่อให้สถานะ `Overdue`, รายงานลูกหนี้ค้างชำระ (Aging, PM-10) และการแจ้งเตือนลูกค้ามีความหมาย แต่ละสาขา (`Property`) มีนโยบายเครดิตต่างกัน และวันที่ต้องตีความตามเวลาท้องถิ่น (Asia/Bangkok) ไม่ใช่ UTC

## Decision

1. **`Property.PaymentTermsDays` (nullable)** เป็นจำนวนวันหลังวันออกบิล; ถ้าเป็น `null` ใช้ `Property.DefaultPaymentTermsDays = 7`; ตั้งค่าได้ผ่าน `GET/PUT /api/v1/admin/properties/{propertyId}/billing-settings` (PUT ต้องมี `admin.properties.manage`; ค่าสูงสุด 365 วัน)
2. **`Invoice.Issue(issuedAt, dueDate)` กำหนด `DueDate` (`DateOnly`)** = วันที่ท้องถิ่นของเวลาที่ออกบิล + Payment Terms ของสาขา ณ เวลาออกบิล (`AnalyticsPeriod.LocalDate` ใช้ Offset คงที่ UTC+7 ไม่ใช้ฐานข้อมูล Time Zone) การแก้ Payment Terms ภายหลังไม่กระทบบิลที่ออกไปแล้ว; คอลัมน์ `DueDate` เพิ่มด้วย Migration `AddDueDatesReceiptsForStaysAndPaymentMethods` และ `PmsDatabaseInitializer` มีขั้น Backfill คอลัมน์ Billing ของข้อมูลเดิม (`BackfillLegacyBillingColumnsAsync`)
3. **`Overdue` เกิดจากกฎโดเมน:** `Invoice.MarkOverdueIfPastDue(today)` เปลี่ยน `Issued`/`PartiallyPaid` เป็น `Overdue` เมื่อ `today > DueDate` (Idempotent); `Overdue` ยังรับชำระได้ (`AcceptsPayment`)
4. **`OverdueInvoiceSweeper` (`BackgroundService` ใน `TanPms.WebApi/Background/`)** รัน 1 รอบทันทีที่เริ่มระบบ แล้วทุก `Billing:OverdueSweepIntervalMinutes` (ค่าเริ่มต้น **60** นาที, ขั้นต่ำ 1) เรียก `IBillingStore.MarkOverdueInvoices` ใน Scope ใหม่ทุกรอบ; รอบที่ล้มเหลว (เช่น DB ยังไม่ Migrate) ถูก Log เป็น Warning และลองใหม่รอบถัดไป ไม่ทำให้โฮสต์ล่ม
5. **แจ้งเตือน Overdue ครั้งเดียวต่อบิล:** `Invoice.OverdueNotifiedAt` + `TryMarkOverdueNotified` สร้าง `NotificationMessage` (ช่อง `InApp`) เพียงครั้งเดียว แม้ภายหลังชำระบางส่วนทำให้สถานะสลับไปมา

## Consequences

- **ข้อดี:** กฎเวลาอยู่ใน Domain ทดสอบได้ (`DueDatesPagingAndReceiptsTests`), Sweeper ธรรมดาไม่พึ่ง Scheduler ภายนอก, ปลอดภัยเมื่อรันซ้ำ
- **ข้อจำกัด:** ไม่ใช่ Distributed Lock — หากรันหลาย Instance จะมีหลาย Sweeper (ผลลัพธ์ยัง Idempotent แต่เปลืองและอาจ Race ที่การแจ้งเตือน ต้องเพิ่ม Lock/Leader Election ก่อน Scale Out); ความล่าช้าของสถานะ `Overdue` สูงสุดเท่า Interval; ยังไม่มีค่าปรับล่าช้า (Late Fee) หรือการแจ้งเตือนซ้ำ/ผ่าน LINE/Email (Adapter ยังไม่มี — มีแต่ช่อง `InApp` ที่ทำงานจริง)
- **Config:** `Billing__OverdueSweepIntervalMinutes` ใน `.env.example`

## Alternatives Considered

- **คำนวณ `Overdue` ตอนอ่าน (Computed Status):** ไม่ต้องมี Job แต่ Query/รายงาน/แจ้งเตือนต้องซ้ำตรรกะและสถานะไม่ถูกเก็บ — ปฏิเสธ
- **Hangfire/Quartz หรือ Cron ภายนอก:** แข็งแรงกว่าแต่เพิ่ม Dependency/Infra เกินความจำเป็นตอนนี้ — พิจารณาใหม่เมื่อ Scale Out
- **Payment Terms ระดับองค์กรเดียว:** ง่ายแต่ไม่ตรงโมเดล Multi-Property — ปฏิเสธ
- **เก็บ `DueDate` เป็น UTC timestamp:** ทำให้วันตัดรอบคลาดเคลื่อนข้ามเขตเวลา — ใช้ `DateOnly` เวลาท้องถิ่น
