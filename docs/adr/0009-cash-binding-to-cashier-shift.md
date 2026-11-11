# ADR-0009: ผูกเงินสดกับ `CashierShift` และการตรวจกะเปิดระดับ `Property`

## Status

Accepted — 2026-11-10

## Context

กฎธุรกิจใน [pricing-meter-and-tax-rules.md](../01-business/pricing-meter-and-tax-rules.md) ห้ามรับ/จ่ายเงินสดโดยไม่มีกะ และการปิดกะต้องกระทบยอดเงินสดได้ (`CashVariance`) เดิมสถานะ "มีกะเปิด" เป็นเพียงค่าบูลีนจาก Header ทดสอบ ไม่ผูกกับรายการเงินจริง และไม่แยกตามสาขา ทำให้พนักงานที่เปิดกะสาขา A อาจรับเงินสดสาขา B ได้

## Decision

1. **กะเปิดได้ 1 กะต่อแคชเชียร์ต่อ `Property`** บังคับด้วย Unique Partial Index `(PropertyId, CashierUserId)` เมื่อ `Status = Open` และไม่ถูกลบ
2. **การตรวจ "มีกะเปิด" ระดับ Property:** `ICurrentUserContext.HasOpenCashierShiftIn(propertyId)` อ่านกะ `Open` จริงของ `UserId` ในสาขานั้นผ่าน `ICashierShiftStore` (ต้องอยู่ใน `AllowedPropertyIds` ด้วย); Header `X-TanPms-Open-Shift` ยังใช้ Override ได้เฉพาะ Dev/Test เท่านั้น (`HttpCurrentUserContext`) และต้องถูกแทนที่เมื่อมี Authentication จริง
3. **การดำเนินการที่ต้องมีกะเปิดในสาขา:** `CheckIn`, `CheckOut`, บันทึกชำระ `Folio` แบบ `Cash`, ย้อนรายการชำระเงินสด (`folio/payments/reverse`) — ไม่มีกะตอบ `shift.not_open` (`409`)
4. **ผูกยอดเงินสดกับกะจริง:** `Receipt.CashierShiftId` เก็บกะที่รับเงิน; เมธอดของ `CashierShift` (`RecordCashReceipt`/ย้อน, `RecordCashDepositReceived`/`Refunded`) สะสม `CashReceiptsInShift`, `CashDepositsReceivedInShift`, `CashDepositsRefundedInShift` และเมธอดเหล่านี้ยืนยันว่ากะเป็น `Open` (ไม่เช่นนั้น `shift.not_open`); `CloseShift(actualCashCounted)` ใช้ `CashierShiftReconciler` คำนวณ `CashVariance`
5. **วงจรกะ:** `Open` -> `Closed` -> `Reconciled`; กะที่ยังไม่มีรายการเงินสดเท่านั้นที่ `Cancel` ได้ (พร้อมเหตุผล) กะที่มีรายการเงินสดต้อง `Close`; กะ `Closed`/`Reconciled` แก้ไขไม่ได้ ยกเว้นหมายเหตุผลต่างก่อน `Reconcile` — ดู [ADR-0010](./0010-delete-cancel-void-policy.md)

## Consequences

- **ข้อดี:** ยอดเงินสดตามกะตรวจสอบย้อนกลับได้ถึงใบเสร็จ, แยกสาขาถูกต้อง, ป้องกันรับเงินสดนอกกะ (`CashierShiftSlipAndDepositTests`, `FilesPdfAndCashBindingTests`)
- **ข้อจำกัด:** ความถูกต้องจริงขึ้นกับ `UserId` ที่ได้จาก Authentication จริง (ตอนนี้ Dev ใช้ Header/ค่าเริ่มต้น); การชำระที่ไม่ใช่เงินสด (โอน/บัตร) ไม่ผูกกะ; ยังไม่มี Hand-over กะข้ามผู้ใช้
- **การเงิน:** `DepositLedger` ยังแยกจากรายได้ตามเดิม

## Alternatives Considered

- **Boolean Header/Claim "มีกะเปิด":** ง่ายแต่ปลอมได้และไม่ผูกยอด — ใช้เฉพาะ Dev/Test
- **ตรวจกะระดับองค์กร (ไม่แยกสาขา):** ไม่ตรงโมเดล Multi-Property — ปฏิเสธ
- **คำนวณยอดเงินสดกะจากการ Query ใบเสร็จตอนปิดกะ:** ไม่ต้องมีฟิลด์สะสม แต่ปิดกะช้าและแก้ย้อนหลังยาก — เลือกสะสมในกะแล้วเทียบตอนปิด
