# Permission Catalog (`PM-01` – `PM-10`) — `tan-pms`

เอกสารนี้รวบรวมรหัสสิทธิ์ (`Permission Key`) มาตรฐานของฝั่ง `admin` (`AdminScope`) ครบทั้ง 10 โมดูล (`PM-01` ถึง `PM-10`)

> อ้างอิงกลไกการตรวจสิทธิ์จาก [rbac-and-scopes.md](./rbac-and-scopes.md)

---

## 1. รูปแบบการตั้งชื่อ Permission Key

ใช้รูปแบบ `admin.<resource>.<action>` เป็นตัวพิมพ์เล็กทั้งหมด:

| โมดูล | Permission Key | คำอธิบายสิทธิ์ | ความเสี่ยงสูง / ต้องบันทึก `AuditEvent` |
|---|---|---|---|
| `PM-01` | `admin.users.read` | ดูรายชื่อพนักงานและบทบาทในสาขา | ไม่ |
| `PM-01` | `admin.users.manage` | สร้าง/แก้ไขผู้ใช้ มอบหมาย `Role` และ `AllowedPropertyIds` รวมถึง Deactivate/Reactivate | **ใช่ (High-Risk)** |
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

---

## 2. การตรวจสอบกับโค้ด (Verified against `PermissionKeys.cs`)

ตรวจเทียบ `backend/src/TanPms.Domain/Identity/PermissionKeys.cs` (ค่าคงที่ 25 ตัว และรายการ `PermissionKeys.All`) กับตารางด้านบนแล้ว: **ครบ 25/25 คีย์** ตรงกันทุกตัว

- **High-Risk (`IsHighRisk = true` ใน `PmsRoleCatalog.Permissions`) มี 7 คีย์:** `admin.users.manage`, `admin.stay.override_dirty_checkin`, `admin.customer.unmask_pii`, `admin.leases.settle_moveout`, `admin.meters.override_locked`, `admin.cashier.reconcile_shift`, `admin.invoices.void` (ตรงกับแถวที่ทำตัวหนาในตาราง)
- คีย์ที่ระบุ "ใช่" แต่ไม่หนา (`admin.properties.manage`, `admin.rates.manage`, `admin.regulatory.export`, `admin.billing.issue_batch`, `admin.payments.verify_slip`) = ต้องบันทึก `AuditEvent` ทุกครั้ง แต่ไม่ถูกตั้ง `IsHighRisk` ในโค้ด
- **ข้อสังเกต:** ค่า `admin.rack.view` ปรากฏเฉพาะในชุดสิทธิ์เริ่มต้นของ Dev (ข้อ 3) และ**ไม่ได้ประกาศใน `PermissionKeys`** และไม่พบการตรวจสิทธิ์นี้ใน `backend/src` — ถือเป็นค่าตกค้าง ควรตัดสินใจว่าจะเพิ่มเป็นคีย์ทางการหรือลบ (ยังไม่ได้ตัดสินใจ)
- **บทบาทมาตรฐาน** ในโค้ด (`PmsRoleCatalog`) คือ `OrganizationAdmin` (ทุกคีย์), `PropertyManager`, `FrontDeskCashier`, `PropertyAccountant`, `HousekeepingStaff`, `MaintenanceTechnician`, `ClientCustomer` (ไม่มีสิทธิ์ `admin.*`)

---

## 3. ชุดสิทธิ์เริ่มต้นของโหมด Dev (`HttpCurrentUserContext`) และสิทธิ์ที่ตั้งใจไม่ให้

ขณะที่ยังไม่มี Authentication จริง `HttpCurrentUserContext` ใช้ Header `X-TanPms-Permissions` ถ้ามี มิฉะนั้นให้ชุดเริ่มต้นดังนี้ (ใช้เฉพาะ Dev/Test ห้ามถือเป็นโมเดลสิทธิ์ของ Production):

- **อยู่ในชุดเริ่มต้น (19 ค่า):** `admin.rack.view`, `admin.stay.checkin`, `admin.stay.checkout`, `admin.users.read`, `admin.users.manage`, `admin.properties.read`, `admin.properties.manage`, `admin.rates.manage`, `admin.reservations.read`, `admin.reservations.manage`, `admin.regulatory.export`, `admin.leases.manage`, **`admin.leases.settle_moveout`**, `admin.meters.record`, `admin.billing.issue_batch`, `admin.housekeeping.update`, `admin.workorders.manage`, `admin.parcels.manage`, `admin.analytics.read`
- **ไม่อยู่ในชุดเริ่มต้น (7 คีย์ ต้องส่งผ่าน Header ชัดเจนเมื่อทดสอบ):** `admin.stay.override_dirty_checkin`, `admin.customer.unmask_pii`, `admin.meters.override_locked`, `admin.cashier.operate_shift`, `admin.cashier.reconcile_shift`, `admin.payments.verify_slip`, `admin.invoices.void` — ห้ามเปิดโดยไม่ตั้งใจ เพราะเป็นสิทธิ์ที่เกี่ยวข้องกับเงินสด การตรวจสลิป การยกเลิกบิล PII และการข้ามกฎความสะอาด/ล็อกมิเตอร์
- **ข้อค้นพบที่ต้องตัดสินใจ:** `admin.leases.settle_moveout` เป็นสิทธิ์ High-Risk (หักค่าเสียหาย/อนุมัติคืนเงินประกัน และใช้กับ `POST .../leases/{id}/cancel` ด้วย) แต่ **อยู่ในชุดเริ่มต้นของ Dev** ซึ่งไม่สอดคล้องกับหลักการข้างต้น (ที่ตัดสิทธิ์ High-Risk อื่นออก ยกเว้น `admin.users.manage` ที่ก็อยู่ในชุดเริ่มต้นเช่นกัน) สถานะ: **รอผู้รับผิดชอบตัดสินใจ** ว่าจะคงไว้เพื่อความสะดวกทดสอบ หรือย้ายออกให้ต้องส่งผ่าน Header
