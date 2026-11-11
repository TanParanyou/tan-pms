# ADR-0010: นโยบาย Delete / Cancel / Void และข้อมูลที่แก้ไขไม่ได้ (Immutability)

## Status

Accepted — 2026-11-08

## Context

เมื่อเพิ่ม CRUD ให้ครบ ต้องกำหนดว่าข้อมูลใดลบจริง/ลบแบบ Soft Delete ได้ และข้อมูลใดต้องใช้การ "ยกเลิก" ที่ทิ้งร่องรอย เพราะเอกสารที่มีผลทางการเงินและกฎหมายภาษีต้องตรวจสอบย้อนหลังได้ ([pdpa-and-audit-redaction.md](../04-data/pdpa-and-audit-redaction.md))

## Decision

1. **Hard/Soft Delete เฉพาะข้อมูลที่ยังไม่มีผลทางการเงิน:** เช่น `Invoice` สถานะ `Draft` และบรรทัดของ Draft, ใบจองสถานะ `Expired` ที่ไม่เคยชำระ (สถานะอื่นของใบจองต้อง `Cancel`), `HousekeepingTask`, ค่ามิเตอร์ของรอบที่ยังไม่ถูกล็อกด้วยบิล (รอบที่ล็อกแล้วต้องมี `admin.meters.override_locked` พร้อมเหตุผล), ผู้พักร่วม/รถ, สลิปสถานะ `Pending` ที่เจ้าของถอนเอง (Soft Delete) และ Master Data ที่ไม่มีข้อมูลอ้างอิง (ถ้ายังถูกอ้างอิง ตอบ `master_data.in_use` `409`)
2. **ข้อมูลที่มีผลทางการเงิน/ตามกฎหมายใช้ Cancel หรือ Void แทนการลบ** ผ่าน `POST .../cancel` หรือ `POST .../void` (เช่น `Invoice` ที่ `Issued` ขึ้นไป -> `Void`, `Stay`, `Lease`, `WorkOrder`, `CashierShift` ที่ไม่มีเงินสด, `Parcel`, รายการ `Folio` Charge, การย้อนการชำระ) พร้อม Body `ReasonRequest { reason }`
3. **เหตุผลบังคับ:** `reason` ว่างตอบ `validation.failed` (`400`); เหตุผลบันทึกใน `AuditEvent` พร้อม Before/After State ผ่าน `IAuditLogger.RecordMutation`
4. **Frontend ต้องแสดง `ConfirmationModal`** และล็อกปุ่มด้วย `isLoading` ทุกครั้ง ตาม [AGENTS.md](../../AGENTS.md) หมวด 6
5. **ข้อมูลที่ไม่ควรถูกแก้ไข (Immutable):**
   - `Invoice` ที่ `Issued`/`Paid`/`Voided` แก้/ลบไม่ได้ -> `invoice.immutable_status` (`409`)
   - `CashierShift` ที่ `Closed`/`Reconciled` (ยกเว้นหมายเหตุผลต่างก่อน Reconcile) และ `Receipt` ที่ออกแล้ว (ไม่มี Endpoint แก้/ลบ มีแต่ `GET` และ PDF)
   - สลิปที่ถูกตรวจ (`Approved`/`Rejected`) แก้ไม่ได้ เพราะออก `Receipt` ไปแล้ว (Maker-Checker)
6. **ผู้ใช้ (`AdminUser`) ไม่ลบ แต่ Deactivate/Reactivate** (`POST /users/{userId}/deactivate|reactivate` พร้อม `ReasonRequest` สำหรับ Deactivate) เพื่อคงประวัติ Audit; ห้ามปิดใช้งาน/ลดสิทธิ์ `OrganizationAdmin` คนสุดท้าย (`master_data.in_use`)
7. **Soft Delete** ใช้คอลัมน์ `IsDeleted` ของ `AuditableEntity` และตัวกรอง Query/Index (Filtered Unique Index) ให้ข้ามแถวที่ถูกลบ

## Consequences

- **ข้อดี:** เส้นทางตรวจสอบครบทุกการเปลี่ยนแปลงทางการเงิน, UX สม่ำเสมอ (ลบ/ยกเลิกต้องยืนยันและระบุเหตุผล), ทดสอบได้ (`CrudLifecycleGapTests`)
- **ข้อจำกัด:** ข้อมูลที่ Soft Delete ยังอยู่ในฐานข้อมูล (ต้องมีนโยบาย Retention/PDPA แยก); ผู้ใช้ต้องแยกให้ออกระหว่าง "ลบ" กับ "ยกเลิก/Void"; Endpoint Cancel/Void ใหม่ต้องเพิ่ม Permission ที่เหมาะสมและบันทึก Audit ทุกครั้ง (ดู [permission-catalog.md](../03-contracts/permission-catalog.md))

## Alternatives Considered

- **Hard Delete ทุกอย่าง:** ง่ายแต่ทำลายหลักฐานทางการเงิน — ปฏิเสธ
- **Soft Delete ทุกอย่างรวมเอกสารที่ออกแล้ว:** ซ่อนจากหน้าจอได้แต่ไม่สื่อเจตนาทางธุรกิจ (ยกเลิก vs ผิดพลาด) และไม่มีเหตุผลในเอกสาร — ปฏิเสธ
- **Event Sourcing / ใบลดหนี้ (Credit Note) เต็มรูปแบบ:** ถูกต้องเชิงบัญชีที่สุดแต่เกินขอบเขตตอนนี้ — พิจารณาใหม่เมื่อมีกฎภาษีเพิ่ม
- **อนุญาตลบผู้ใช้:** ทำให้ Audit อ้าง `UserId` ที่ไม่มีอยู่ — ปฏิเสธ
