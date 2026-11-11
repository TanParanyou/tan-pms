# RBAC & Dual-Scope Isolation (`AdminScope` & `ClientScope`) — `tan-pms`

เอกสารนี้กำหนดสถาปัตยกรรมการควบคุมสิทธิ์และการแยกขอบเขตข้อมูลระหว่างฝั่งพนักงาน/ผู้บริหาร (`admin`) และฝั่งลูกค้า/ผู้เช่า (`client`) ของ **`tan-pms`**

> อ้างอิงรายการสิทธิ์ทั้งหมดจาก [permission-catalog.md](./permission-catalog.md) และมาตรฐาน PDPA จาก [pdpa-and-audit-redaction.md](../04-data/pdpa-and-audit-redaction.md)

---

## 1. การแยกบริบทสิทธิ์ 2 แกน (`AdminScope` vs `ClientScope`)

ระบบใช้หลักการ **Deny by Default** และตรวจสอบสิทธิ์ที่ฝั่ง Backend 100% โดยแบ่งผู้ใช้งานออกเป็น 2 Scope ที่แยกขาดจากกัน:

### 1.1 `AdminScope` (สำหรับ `/api/v1/admin/...`)
ผู้ใช้งานฝั่ง `admin` (เช่น พนักงานต้อนรับ, แคชเชียร์, แม่บ้าน, ช่างซ่อม, ผู้จัดการสาขา, ผู้บริหาร) จะมีข้อมูลใน Security Context ดังนี้:
- `UserId`: รหัสผู้ใช้งานพนักงาน
- `AllowedPropertyIds`: รายการ `PropertyId` ที่พนักงานคนนั้นได้รับอนุญาตให้เข้าถึง (เช่น พนักงานประจำสาขาเห็นเฉพาะสาขาตนเอง ส่วนผู้บริหารระดับองค์กรเห็นได้ทุกสาขา)
- `Permissions`: ชุดของ Permission Keys ที่รวมมาจากบทบาท (`Role`) ของผู้ใช้

**กฎเหล็กของ `AdminScopeFilter`:**
1. ทุก Request ที่ระบุ `propertyId` ต้องตรวจสอบว่า `AllowedPropertyIds.Contains(propertyId)` หากไม่ตรงต้องปฏิเสธด้วย `403 Forbidden` (`auth.property_scope_denied`) หรือซ่อนข้อมูล (`404`)
2. ทุกคิวรีระดับรายการต้องบังคับ `WHERE property_id = ANY(@AllowedPropertyIds)` เสมอ

### 1.2 `ClientScope` (สำหรับ `/api/v1/client/...`)
ผู้ใช้งานฝั่ง `client` (ลูกค้าจองห้องพักออนไลน์หรือผู้เช่ารายเดือน) จะมีข้อมูลใน Security Context ดังนี้:
- `UserId`: รหัสบัญชีผู้ใช้ฝั่ง `client`
- `CustomerId`: รหัส `Customer` ที่ผูกกับบัญชีนั้นแบบ 1:1

**กฎเหล็กของ `ClientScopeFilter`:**
1. ห้ามรับ `customerId` จาก Query String หรือ Request Body มาใช้ค้นหาข้อมูลเด็ดขาด
2. ทุก Command และ Query ใน `/api/v1/client/...` ต้องบังคับกรองด้วย `WHERE customer_id = @CurrentCustomerId` เสมอ (เห็นเฉพาะ `Reservation`, `Lease`, `Invoice`, `Receipt`, `WorkOrder` และ `Parcel` ของตนเองเท่านั้น)

---

## 2. บทบาทมาตรฐานเริ่มต้น (Default Enterprise Roles)

| บทบาท (Role) | Scope | ขอบเขต `Property` | หน้าที่หลัก |
|---|---|---|---|
| `OrganizationAdmin` | `AdminScope` | ทุก `Property` | ตั้งค่าองค์กร สาขา เรตราคา ภาษี และดูรายงานบริหารทั้งหมด |
| `PropertyManager` | `AdminScope` | เฉพาะ `Property` ที่ดูแล | อนุมัติการ `Void` บิล, อนุมัติคืนเงินประกัน, กระทบยอดกะแคชเชียร์ (`Reconcile`) และ Override ห้อง `Dirty` |
| `FrontDeskCashier` | `AdminScope` | เฉพาะ `Property` ที่ดูแล | เปิด-ปิดกะแคชเชียร์ (`CashierShift`), เปิดห้อง `Hourly`/`Daily`, ตรวจสลิปโอนเงิน, รับพัสดุ (`Parcel`) |
| `PropertyAccountant` | `AdminScope` | ตามที่ได้รับมอบหมาย | ตรวจตารางมิเตอร์น้ำ-ไฟ, สั่งรัน `Batch Invoice Run`, ออกรายงานภาษีและลูกหนี้ค้างชำระ |
| `HousekeepingStaff` | `AdminScope` | เฉพาะ `Property` ที่ดูแล | อัปเดตสถานะความสะอาดห้อง (`HousekeepingTask`: `Dirty` -> `Cleaning` -> `Clean`) |
| `MaintenanceTechnician` | `AdminScope` | เฉพาะ `Property` ที่ดูแล | รับใบงานแจ้งซ่อม (`WorkOrder`), อัปเดตผลซ่อมและแนบรูปหลังซ่อม |
| `ClientCustomer` | `ClientScope` | ผูกตาม `CustomerId` | จองห้องออนไลน์ (`Hold TTL`), ดูสัญญาเช่า/ใบแจ้งหนี้, แนบสลิป, แจ้งซ่อม และดูพัสดุของตนเอง |

---

## 3. การยืนยันตัวตนและการบังคับใช้ในโค้ดปัจจุบัน

- **Bearer JWT (โหมด `Auth:Mode=Jwt` ค่าเริ่มต้น):** ทุก Endpoint ใต้ `/api/v1` ยกเว้น `/auth/login` และ `/auth/refresh` ต้องส่ง `Authorization: Bearer <accessToken>` Token มีเฉพาะ `sub`, `scope`, `jti`, `iat`, `exp`; `JwtCurrentUserContext` อ่าน `Permissions`, `AllowedPropertyIds`, `CustomerId` และกะเปิดจาก Store ต่อ Request ดังนั้นการ Deactivate/เปลี่ยนสิทธิ์มีผลทันที ตาม [ADR-0011](../adr/0011-authentication-with-own-jwt.md)
- **Header `X-TanPms-*` (`X-TanPms-User-Id`, `-Scope`, `-Allowed-Properties`, `-Permissions`, `-Customer-Id`, `-Open-Shift`) ใช้ได้เฉพาะ Dev/Test:** อ่านโดย `HttpCurrentUserContext` เมื่อ `Auth:Mode=Headers` เท่านั้น ซึ่งระบบปฏิเสธการเริ่มทำงานนอก `Development`/`Testing`; **ไม่ใช่กลไกยืนยันตัวตนของ Production** และโหมด `Jwt` ไม่อ่าน Header เหล่านี้
- **`AuthGateMiddleware`:** ไม่มี/Token ไม่ถูกต้อง/ผู้ใช้ไม่ Active = `401`; Scope ของ Token ไม่ตรงกลุ่ม `/admin` หรือ `/client` = `403` (`auth.permission_denied`) ส่วนสิทธิ์รายฟีเจอร์และ `AllowedPropertyIds` ตรวจต่อใน Handler
- **Endpoint ยืนยันตัวตน:** ดูรายละเอียดใน [api-conventions.md](./api-conventions.md) หัวข้อ 7
- **กะแคชเชียร์ระดับสาขา:** `HasOpenCashierShiftIn(propertyId)` ต้องอยู่ใน `AllowedPropertyIds` และมีกะ `Open` จริงของผู้ใช้ในสาขานั้น ตาม [ADR-0009](../adr/0009-cash-binding-to-cashier-shift.md) (Header `X-TanPms-Open-Shift` Override ได้เฉพาะโหมด `Headers`)
- **บัญชีลูกค้า:** สร้างโดยพนักงาน (สิทธิ์ `admin.leases.manage` หรือ `admin.stay.checkin`) ไม่มีการสมัครเอง/Forgot-Password
- **ไฟล์แนบ:** ตรวจสิทธิ์ตาม `purpose` และเจ้าของ ตาม [ADR-0005](../adr/0005-authorized-file-storage-stored-file.md); ฝั่ง `client` ตอบ `auth.permission_denied` เหมือนกันทั้งกรณีไม่พบและเป็นของผู้อื่น
- **ผู้ใช้:** Deactivate แทนการลบ และห้ามปิดใช้งาน/ลดสิทธิ์ `OrganizationAdmin` คนสุดท้าย ตาม [ADR-0010](../adr/0010-delete-cancel-void-policy.md)
