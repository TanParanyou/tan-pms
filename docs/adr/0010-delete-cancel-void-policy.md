# ADR-0010: นโยบาย Delete / Cancel / Void และข้อมูลที่แก้ไขไม่ได้ (Immutability)

## Status

Accepted — 2026-11-08

## Context

เมื่อเพิ่ม CRUD ให้ครบ ต้องกำหนดว่าข้อมูลใดลบจริง/ลบแบบ Soft Delete ได้ และข้อมูลใดต้องใช้การ "ยกเลิก" ที่ทิ้งร่องรอย เพราะเอกสารที่มีผลทางการเงินและกฎหมายภาษีต้องตรวจสอบย้อนหลังได้ ([pdpa-and-audit-redaction.md](../04-data/pdpa-and-audit-redaction.md))

## Decision

> ข้อความส่วนนี้ตรวจกับโค้ดแล้ว (Domain methods, Store, `Program.cs`) ยกเว้นที่ระบุว่า "ไม่ได้ตรวจ"

1. **ไม่มี Hard Delete ผ่าน API:** `DELETE` ทุก Endpoint เรียก `Remove` ของ EF ซึ่ง `AuditableEntityInterceptor` แปลงเป็น Soft Delete (`MarkDeleted` ตั้ง `IsDeleted`) และ Query มี Global Filter ซ่อนแถวที่ถูกลบ (ไม่ได้ตรวจว่ามี Job ลบจริงภายหลัง)
2. **`DELETE` ใช้กับข้อมูลที่ยังไม่มีผลทางการเงินเท่านั้น (ตามกฎของแต่ละ Entity):**
   - `Invoice` สถานะ `Draft` เท่านั้น (`EnsureCanDelete`, มิฉะนั้น `invoice.immutable_status`) และบรรทัดของ Draft
   - ใบจอง (`Reservation`) เฉพาะสถานะ `Expired` ที่ไม่เคยชำระ (สถานะอื่นต้อง `Cancel`)
   - `HousekeepingTask` เฉพาะสถานะ `Pending`
   - ค่ามิเตอร์ของหน่วยในรอบ: ถ้ารอบถูกล็อกด้วยบิลต้องมี `admin.meters.override_locked` พร้อมเหตุผล (ไม่เช่นนั้น `auth.permission_denied`)
   - ผู้พักร่วม/รถของ `Lease`/`Stay`, สลิปสถานะ `Pending` ที่เจ้าของถอนเอง (`EnsureCanWithdraw`), `LeaseIntent` ที่ลูกค้าถอน และ Master Data (`Unit`, `Building`, `Floor`, `UnitType`, `RatePlan`, `UtilityTariff`, `TaxProfile`) — Master Data ที่ยังถูกอ้างอิงตอบ `master_data.in_use` `409` (กฎของ Master Data รายตัวไม่ได้ไล่ตรวจทุกตัว)
   - **ไม่มี `DELETE` ของ** `Lease`, `Stay`, `CashierShift`, `Receipt`, ผู้ใช้ — เอกสารเหล่านี้ใช้ Cancel/Void/Deactivate หรือแก้ไม่ได้เลย
3. **Cancel/Void (`POST` + `ReasonRequest { reason }`) — เงื่อนไขจริงต่อ Entity:**
   - `Lease.Cancel`: เฉพาะ `Active`; ต้องไม่มีบิลที่ออกแล้ว (ทุกใบต้องเป็น `Draft`/`Voided`); คืนมัดจำคงเหลือ (เงินสดผูกกะถ้ามี); `Draft` ของสัญญาถูก Soft Delete; ห้องถูกบันทึกเป็นออกแล้วและเพิ่มงานแม่บ้าน (`MarkCheckedOutOrMovedOut`)
   - `Stay` (`CancelMistakenCheckIn`): เฉพาะ `Active`, ไม่ได้มาจากใบจอง (ต้อง CheckOut), ไม่มียอดชำระและไม่มีรายการ `Folio` เกินค่าห้องตั้งต้น
   - `Invoice.Void`: ใช้กับสถานะที่ไม่ใช่ `Draft`, ต้องมี `admin.invoices.void`; **ถูกบล็อกถ้ามีใบเสร็จแล้วหรือมีสลิปที่ไม่ใช่ `Rejected`** (`invoice.immutable_status`) — ในทางปฏิบัติ Void ได้เฉพาะบิลที่ยังไม่มีการชำระ
   - `CashierShift.Cancel`: เฉพาะ `Open`, ไม่มีกิจกรรมเงินสด, ไม่มีใบเสร็จผูกกะ (ดู [ADR-0009](./0009-cash-binding-to-cashier-shift.md)); กะที่มีกิจกรรมต้อง `Close`
   - `WorkOrder.Cancel`: ไม่ใช่ `Cancelled` และไม่ใช่ `Completed` ที่โพสต์ค่าใช้จ่ายผู้เช่าแล้ว
   - `Parcel.Void`: เฉพาะพัสดุสถานะ `Arrived` (ยังไม่ส่งมอบ); เนื่องจาก `ParcelStatus` ไม่มีค่า Cancelled ระบบบันทึก `VoidReason` แล้ว Soft Delete แถว
   - รายการ `Folio` Charge (`void`) และการย้อนชำระ `Folio` (`payments/reverse`, ต้องมี `admin.invoices.void`) — ไม่ได้ตรวจเงื่อนไขภายในทุกกรณี
4. **เหตุผลบังคับ:** `reason` ว่างตอบ `validation.failed` (`400`) และบันทึกใน `AuditEvent` ผ่าน `IAuditLogger.RecordMutation` (ตรวจ Handler ของ Cancel/Void หลัก; ไม่ได้ตรวจครบทุก Handler ว่ามี Audit)
5. **Frontend ต้องแสดง `ConfirmationModal`** และล็อกปุ่มด้วย `isLoading` ตาม [AGENTS.md](../../AGENTS.md) หมวด 6 (เป็นกฎของโครงการ ไม่ได้ตรวจทุกหน้าจอในรอบนี้)
6. **ข้อมูลที่แก้ไขไม่ได้ (Immutable):**
   - `Invoice` ที่ไม่ใช่ `Draft` แก้บรรทัด/ลบไม่ได้ -> `invoice.immutable_status` (`409`); ใบเสร็จ (`Receipt`) ไม่มี Endpoint แก้/ลบ (มีแต่ `GET` และ PDF)
   - `CashierShift`: ไม่มี Endpoint ลบ; กะ `Closed` แก้ได้เฉพาะหมายเหตุผลต่างก่อน `Reconcile`; กะ `Reconciled` ไม่มีเมธอดแก้ไขใน Domain
   - สลิปที่ถูกตรวจ (`Approved`/`Rejected`) แก้/ถอนไม่ได้ (`EnsurePending` -> `validation.failed`)
7. **ผู้ใช้ (`AdminUser`) ไม่ลบ แต่ `POST /users/{userId}/deactivate` (ต้องมี `ReasonRequest`) และ `reactivate`** (ไม่มี `DELETE` ผู้ใช้); ห้ามปิดใช้งาน/ลดสิทธิ์ `OrganizationAdmin` คนสุดท้าย (`master_data.in_use`)

## Consequences

- **ข้อดี:** เส้นทางตรวจสอบครบทุกการเปลี่ยนแปลงทางการเงิน, UX สม่ำเสมอ (ลบ/ยกเลิกต้องยืนยันและระบุเหตุผล), ทดสอบได้ (`CrudLifecycleGapTests`)
- **ข้อจำกัด:** ข้อมูลที่ Soft Delete ยังอยู่ในฐานข้อมูล (ต้องมีนโยบาย Retention/PDPA แยก); ผู้ใช้ต้องแยกให้ออกระหว่าง "ลบ" กับ "ยกเลิก/Void"; Endpoint Cancel/Void ใหม่ต้องเพิ่ม Permission ที่เหมาะสมและบันทึก Audit ทุกครั้ง (ดู [permission-catalog.md](../03-contracts/permission-catalog.md))

## Alternatives Considered

- **Hard Delete ทุกอย่าง:** ง่ายแต่ทำลายหลักฐานทางการเงิน — ปฏิเสธ
- **Soft Delete ทุกอย่างรวมเอกสารที่ออกแล้ว:** ซ่อนจากหน้าจอได้แต่ไม่สื่อเจตนาทางธุรกิจ (ยกเลิก vs ผิดพลาด) และไม่มีเหตุผลในเอกสาร — ปฏิเสธ
- **Event Sourcing / ใบลดหนี้ (Credit Note) เต็มรูปแบบ:** ถูกต้องเชิงบัญชีที่สุดแต่เกินขอบเขตตอนนี้ — พิจารณาใหม่เมื่อมีกฎภาษีเพิ่ม
- **อนุญาตลบผู้ใช้:** ทำให้ Audit อ้าง `UserId` ที่ไม่มีอยู่ — ปฏิเสธ
