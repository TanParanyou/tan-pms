# Permission Catalog (`PM-01` – `PM-10`) — `tan-pms`

เอกสารนี้รวบรวมรหัสสิทธิ์ (`Permission Key`) มาตรฐานของฝั่ง `admin` (`AdminScope`) ครบทั้ง 10 โมดูล (`PM-01` ถึง `PM-10`)

> อ้างอิงกลไกการตรวจสิทธิ์จาก [rbac-and-scopes.md](./rbac-and-scopes.md)

---

## 1. รูปแบบการตั้งชื่อ Permission Key

ใช้รูปแบบ `admin.<resource>.<action>` เป็นตัวพิมพ์เล็กทั้งหมด:

| โมดูล | Permission Key | คำอธิบายสิทธิ์ | ความเสี่ยงสูง (ต้องบันทึก `AuditEvent`) |
|---|---|---|---|
| `PM-01` | `admin.users.read` | ดูรายชื่อพนักงานและบทบาทในสาขา | ไม่ |
| `PM-01` | `admin.users.manage` | สร้าง/แก้ไขผู้ใช้ มอบหมาย `Role` และ `AllowedPropertyIds` | ใช่ |
| `PM-02` | `admin.properties.read` | ดูข้อมูล `Property`, `Building`, `Floor`, `UnitType`, `Unit` | ไม่ |
| `PM-02` | `admin.properties.manage` | สร้าง/แก้ไขผังตึก ประเภทห้อง ห้องพัก และ `UnitAsset` | ใช่ |
| `PM-03` | `admin.rates.manage` | ตั้งค่าเรตราคารายชั่วโมง/รายวัน/รายเดือน อัตราน้ำ-ไฟ และ `TaxProfile` | ใช่ |
| `PM-04` | `admin.reservations.read` | ดูตารางห้องว่างรวม (`Unified Room Rack`) และรายการใบจอง | ไม่ |
| `PM-04` | `admin.reservations.manage` | สร้าง/แก้ไขใบจอง จัดสรรเลข `Unit` และยกเลิกใบจอง | ไม่ |
| `PM-05` | `admin.stay.checkin` | เปิดห้องพักรายชั่วโมง/รายวัน (`Stay`) และจัดการ `Folio` | ไม่ |
| `PM-05` | `admin.stay.checkout` | ทำรายการเช็กเอาต์และสรุปยอด `Folio` | ไม่ |
| `PM-05` | `admin.stay.override_dirty_checkin` | อนุมัติเปิดห้องพักที่มีสถานะ `Dirty` กรณีฉุกเฉิน (บังคับระบุเหตุผล) | **ใช่ (High-Risk)** |
| `PM-05` | `admin.customer.unmask_pii` | เปิดดูเลขบัตรประชาชน/พาสปอร์ตเต็ม (ไม่ติด Masking `1-xxxx-xxxxx-12-3`) | **ใช่ (High-Risk)** |
| `PM-05` | `admin.regulatory.export` | ส่งออกรายงานทะเบียนผู้เข้าพัก ร.ร.4 และ ตม.30 (TM.30) | ใช่ |
| `PM-06` | `admin.leases.manage` | สร้าง/ต่อสัญญาเช่ารายเดือน (`Lease`), บันทึกผู้พักร่วมและป้ายทะเบียนรถ | ไม่ |
| `PM-06` | `admin.leases.settle_moveout` | ทำรายการย้ายออก หักค่าเสียหาย และอนุมัติคืนเงินประกันสัญญา | **ใช่ (High-Risk)** |
| `PM-07` | `admin.meters.record` | กรอกเลขมิเตอร์น้ำ-ไฟประจำรอบบิล (`MeterReading`) | ไม่ |
| `PM-07` | `admin.meters.override_locked` | แก้ไขเลขมิเตอร์หลังจากออกใบแจ้งหนี้ไปแล้ว (บังคับระบุเหตุผล) | **ใช่ (High-Risk)** |
| `PM-07` | `admin.billing.issue_batch` | สั่งประมวลผลและอนุมัติออกใบแจ้งหนี้รายเดือนยกตึก (`Batch Invoice Run`) | ใช่ |
| `PM-08` | `admin.cashier.operate_shift` | เปิดกะ รับชำระเงินสด/เงินมัดจำ และนับเงินปิดกะ (`CashierShift`) | ไม่ |
| `PM-08` | `admin.cashier.reconcile_shift` | ตรวจสอบและอนุมัติผลต่างเงินสดกะแคชเชียร์ (`Reconciled`) | **ใช่ (High-Risk)** |
| `PM-08` | `admin.payments.verify_slip` | ตรวจสอบและอนุมัติสลิปโอนเงินจากคิว `PendingVerification` | ใช่ |
| `PM-08` | `admin.invoices.void` | ยกเลิกใบแจ้งหนี้หรือใบเสร็จรับเงินที่ออกแล้ว (`Voided` พร้อมระบุเหตุผล) | **ใช่ (High-Risk)** |
| `PM-09` | `admin.housekeeping.update` | อัปเดตสถานะความสะอาดห้อง (`HousekeepingTask`) | ไม่ |
| `PM-09` | `admin.workorders.manage` | รับแจ้งซ่อม มอบหมายช่าง และส่งยอดค่าซ่อมเข้าบิล | ไม่ |
| `PM-09` | `admin.parcels.manage` | บันทึกรับพัสดุหน้าเคาน์เตอร์และบันทึกการส่งมอบพัสดุ (`Parcel`) | ไม่ |
| `PM-10` | `admin.analytics.read` | ดูแดชบอร์ดผู้บริหาร (`Occupancy Rate`, `RevPAR`, `Aging Report`) | ไม่ |
