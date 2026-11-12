# ADR-0009: ผูกเงินสดกับ `CashierShift` และการตรวจกะเปิดระดับ `Property`

## Status

Accepted — 2026-11-10

## Context

กฎธุรกิจใน [pricing-meter-and-tax-rules.md](../01-business/pricing-meter-and-tax-rules.md) ห้ามรับ/จ่ายเงินสดโดยไม่มีกะ และการปิดกะต้องกระทบยอดเงินสดได้ (`CashVariance`) เดิมสถานะ "มีกะเปิด" เป็นเพียงค่าบูลีนจาก Header ทดสอบ ไม่ผูกกับรายการเงินจริง และไม่แยกตามสาขา (ตามที่เอกสารรอบก่อนระบุ ไม่ได้ตรวจย้อนโค้ดเก่า) ทำให้พนักงานที่เปิดกะสาขา A อาจรับเงินสดสาขา B ได้

## Decision

1. **กะเปิดได้ 1 กะต่อแคชเชียร์ต่อ `Property`** บังคับด้วย Unique Partial Index `(PropertyId, CashierUserId)` เมื่อ `Status = Open` และไม่ถูกลบ
2. **การตรวจ "มีกะเปิด" ระดับ Property:** `ICurrentUserContext.HasOpenCashierShiftIn(propertyId)` อ่านกะ `Open` จริงของ `UserId` ในสาขานั้นผ่าน `ICashierShiftStore` (ต้องอยู่ใน `AllowedPropertyIds` ด้วย); Header `X-TanPms-Open-Shift` ใช้ Override ได้เฉพาะโหมด `Auth:Mode=Headers` (Dev/Test) ส่วนโหมด `Jwt` (`JwtCurrentUserContext`) อ่านกะจริงจาก Store เสมอ
3. **Handler ที่บังคับกะเปิดในสาขา (`shift.not_open` `409`):** `CheckIn` และ `CheckOut` (บังคับเสมอไม่ว่าจะจ่ายด้วยวิธีใด), บันทึกชำระ `Folio` เมื่อ `PaymentMethod = Cash` เท่านั้น, ย้อนรายการชำระ `Folio` เมื่อ `PaymentMethod = Cash` เท่านั้น (ต้องมี `admin.invoices.void`) — ตรวจผ่าน `HasOpenCashierShiftIn(propertyId)`
4. **Handler ที่ส่ง `cashierUserId` ให้ Store เพื่อผูกยอดกับกะ:** `CheckIn` (มัดจำกุญแจเงินสด), `CheckOut` (คืนมัดจำ), บันทึกชำระ/ย้อนชำระ `Folio`, สร้าง `Lease` (มัดจำเมื่อวิธีรับเป็น `Cash`), ย้ายออก/ยกเลิก `Lease` (คืนมัดจำเมื่อวิธีคืนเป็น `Cash`, ค่าเริ่มต้น `Cash`) Store หากะ `Open` ของ `(PropertyId, cashierUserId)` ผ่าน `FindTrackedOpenShift`
5. **ผลต่อกะ (เฉพาะเงินสด):** `RecordCashReceipt`/`ReverseCashReceipt` สะสม `CashReceiptsInShift` และ `RecordCashDepositReceived`/`RecordCashDepositRefunded` สะสมยอดมัดจำ โดยโอน/PromptPay ไม่แตะกะ; ใบเสร็จของ `Folio` เก็บ `CashierShiftId`; เมธอดเหล่านี้ยืนยันกะเป็น `Open` (`shift.not_open`); `CloseShift(actualCashCounted)` ใช้ `CashierShiftReconciler` คำนวณ `ExpectedDrawerCash`/`CashVariance`
6. **ข้อสังเกต/ข้อจำกัดที่ตรวจพบในโค้ด:** (ก) ฝั่ง `Lease` (สร้าง/ย้ายออก/ยกเลิก) Handler ไม่ตรวจกะเปิดล่วงหน้า — ถ้าไม่มีกะ `Open` Store ส่ง `shift = null` และเงินสดจะไม่ถูกผูกกับกะ (ไม่ล้มเหลว); (ข) การอนุมัติสลิปโอนเงิน (Maker-Checker) ไม่ผูกกะ; (ค) ไม่ได้ตรวจว่าทุกเส้นทางของ Handler ใน `InMemoryOperationalService` ตรงกับ `EfCorePmsStore` ทุกบรรทัด (พบการเรียก `RecordCashReceipt`/`ReverseCashReceipt` ในทั้งสองแล้ว)
7. **วงจรกะ:** `Open` -> `Closed` -> `Reconciled`; ยกเลิก (`Cancel`) ได้เฉพาะกะ `Open` ที่ไม่มีกิจกรรมเงินสด (`HasActivity` เป็นเท็จ) **และไม่มีใบเสร็จผูกกะ** พร้อมเหตุผล (แคชเชียร์ยกเลิกได้เฉพาะกะตนเอง ผู้ที่มี `admin.cashier.reconcile_shift` ยกเลิกได้ทุกกะ); แก้หมายเหตุผลต่างได้เฉพาะกะ `Closed` (บังคับเมื่อมีผลต่าง); `Reconcile` ได้เฉพาะ `Closed`; ไม่มี Endpoint ลบกะ — ดู [ADR-0010](./0010-delete-cancel-void-policy.md)

## Consequences

- **ข้อดี:** ยอดเงินสดตามกะตรวจสอบย้อนกลับได้ถึงใบเสร็จ, แยกสาขาถูกต้อง, ป้องกันรับเงินสดนอกกะ (`CashierShiftSlipAndDepositTests`, `FilesPdfAndCashBindingTests`)
- **ข้อจำกัด:** ในโหมด `Jwt` `UserId` มาจาก Token (ดู [ADR-0011](./0011-authentication-with-own-jwt.md)); Header `X-TanPms-Open-Shift` ใช้ Override ได้เฉพาะโหมด `Headers` (Dev/Test); การชำระที่ไม่ใช่เงินสด (โอน/บัตร) ไม่ผูกกะ; ยังไม่มี Hand-over กะข้ามผู้ใช้
- **การเงิน:** `DepositLedger` ยังแยกจากรายได้ตามเดิม

## Alternatives Considered

- **Boolean Header/Claim "มีกะเปิด":** ง่ายแต่ปลอมได้และไม่ผูกยอด — ใช้เฉพาะ Dev/Test
- **ตรวจกะระดับองค์กร (ไม่แยกสาขา):** ไม่ตรงโมเดล Multi-Property — ปฏิเสธ
- **คำนวณยอดเงินสดกะจากการ Query ใบเสร็จตอนปิดกะ:** ไม่ต้องมีฟิลด์สะสม แต่ปิดกะช้าและแก้ย้อนหลังยาก — เลือกสะสมในกะแล้วเทียบตอนปิด
