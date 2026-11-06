# Scope, Non-Goals & Anti-Goals — `tan-pms`

เอกสารนี้กำหนดขอบเขตของระบบ (`In-Scope`), สิ่งที่ไม่อยู่ในขอบเขตระยะแรก (`Non-Goals`) และสิ่งที่ถือเป็นความล้มเหลวของระบบ (`Anti-Goals`) ของ **`tan-pms`**

> อ้างอิงคำศัพท์หลักจาก [CONTEXT.md](../../CONTEXT.md) และภาพรวมวิสัยทัศน์จาก [product-vision.md](./product-vision.md)

---

## 1. ขอบเขตของระบบ (In-Scope — 10 Vertical Slices)

ระบบ `tan-pms` ครอบคลุมการบริหารจัดการที่พักสำหรับ **Single-Organization, Multi-Property/Multi-Building** ทั้งฝั่ง `admin` และ `client` แบ่งเป็น 10 โมดูลหลัก (`PM-01` ถึง `PM-10`):

1. **`PM-01` Foundation, Identity, Multi-Property RBAC & Notification Core:** การยืนยันตัวตนแยก `AdminScope` / `ClientScope`, สิทธิ์รายสาขา (`AllowedPropertyIds`), `DocumentNumberService` และ `INotificationSender`
2. **`PM-02` Property, Building, Floor, UnitType & Unit Master:** โครงสร้างสาขา-อาคาร-ชั้น-ประเภทห้อง-ห้องพัก และทะเบียนทรัพย์สินประจำห้อง (`UnitAsset`)
3. **`PM-03` Rate Plans, Hourly Packages, Utility Tariffs & Tax Rules:** กฎราคารายชั่วโมง/รายวัน/รายเดือน, อัตราค่าน้ำ-ไฟ และกฎภาษีรายบรรทัด (`TaxProfile`)
4. **`PM-04` Unified Availability Engine, Booking Hold (TTL) & Reservation:** ระบบตรวจสอบห้องว่างรวม 3 โหมด, การจองแบบโควตา `UnitType` และระบุ `Unit`, และระบบล็อกห้องชั่วคราว (`Hold TTL`)
5. **`PM-05` Front Desk: Hourly & Daily Stay, Guest Folio & Regulatory Export:** เปิดห้องด่วน, จับเวลาห้องรายชั่วโมง, บัญชีค่าใช้จ่ายประจำห้อง (`Folio`) และส่งออกรายงาน ร.ร.4 / ตม.30
6. **`PM-06` Monthly Lease Lifecycle, Co-occupants & Vehicle Registry:** สัญญาเช่ารายเดือน (`Lease`), บันทึกส่งมอบห้อง, ทะเบียนผู้พักร่วม/ป้ายทะเบียนรถ และการย้ายออก/คืนเงินประกัน
7. **`PM-07` Bulk Utility Meter Reading & Batch Monthly Billing:** ตารางจดมิเตอร์น้ำ-ไฟยกตึก (`MeterReading`) และการประมวลผลใบแจ้งหนี้รายเดือนอัตโนมัติ (`Batch Invoice Run`)
8. **`PM-08` Cashier Shift, Payment Slip Verification & Deposit Ledger:** การเปิด-ปิดกะแคชเชียร์ (`CashierShift`), คิวตรวจสลิปโอนเงิน และทะเบียนคุมเงินมัดจำ/เงินประกัน (`DepositLedger`)
9. **`PM-09` Housekeeping, Maintenance Work Orders & Parcel Management:** กระดานงานแม่บ้าน (`HousekeepingTask`), ใบแจ้งซ่อม (`WorkOrder`) และระบบรับพัสดุผู้เช่า (`Parcel`)
10. **`PM-10` Client Self-Service Experience & Executive Analytics:** หน้าบริการตนเองของลูกค้า/ผู้เช่า (`/client/...`) และแดชบอร์ดวิเคราะห์ข้อมูลผู้บริหาร (`/admin/analytics`)

---

## 2. สิ่งที่ไม่อยู่ในขอบเขตระยะแรก (Explicit Non-Goals)

1. **ไม่ทำระบบ Multi-Tenant SaaS ข้ามนิติบุคคลอิสระ:** ระบบออกแบบสำหรับองค์กรเดียวที่มีหลายสาขาและหลายตึก (ใช้ `PropertyId` เป็นแกนแยกข้อมูลสาขาและเลขสาขาภาษี)
2. **ไม่ทำระบบบัญชีแยกประเภทเต็มรูปแบบ (Full General Ledger / ERP Accounting):** ระบบรับผิดชอบตั้งแต่การตั้งหนี้ (`Invoice`), รับชำระ (`Receipt`), ภาษีมูลค่าเพิ่ม/หัก ณ ที่จ่าย และทะเบียนเงินมัดจำ (`DepositLedger`) พร้อมส่งออกข้อมูลให้ฝ่ายบัญชี แต่ไม่จัดทำงบดุลหรืองบกำไรขาดทุนระดับบัญชีแยกประเภท
3. **ไม่พัฒนาแอปพลิเคชันมือถือแยก (`Flutter` / Native App) ในเฟสแรก:** ใช้เว็บแอปพลิเคชัน `Next.js` แบบ Responsive ที่รองรับการใช้งานบนสมาร์ตโฟนและแท็บเล็ตทั้งสำหรับแม่บ้าน/ช่างจดมิเตอร์ในฝั่ง `admin` และผู้เช่าในฝั่ง `client`
4. **ไม่เชื่อมต่อฮาร์ดแวร์สมาร์ตมิเตอร์ (IoT AMR) หรือตู้คีย์การ์ดอัตโนมัติโดยตรงในเฟสแรก:** เตรียมเฉพาะโครงสร้างข้อมูลและ API ที่พร้อมต่อยอดในอนาคต

---

## 3. สิ่งที่ต้องหลีกเลี่ยงเด็ดขาด (Anti-Goals / Failure Conditions)

แม้โค้ดจะคอมไพล์ผ่าน แต่หากเกิดกรณีต่อไปนี้ถือว่าระบบไม่ผ่านเกณฑ์มาตรฐาน:

1. **เกิดการจองหรือเปิดห้องทับซ้อนกัน (Double-Booking):** ไม่ว่าจะข้ามโหมด `Hourly`, `Daily` หรือ `Monthly` หรือปล่อยให้เปิดห้องที่ `Unit.ConditionStatus != Clean` โดยไม่มีสิทธิ์ Override และไม่มีการบันทึก `AuditEvent`
2. **การปะปนระหว่างเงินประกันกับรายได้:** การบันทึกเงินประกันสัญญาหรือเงินมัดจำกุญแจเป็นรายได้ทันทีโดยไม่ผ่าน `DepositLedger`
3. **การละเมิดขอบเขตข้อมูล (`AdminScope` / `ClientScope` Leak):** พนักงานสาขาหนึ่งเห็นข้อมูลของสาขาที่ไม่ได้รับสิทธิ์ หรือผู้เช่าในฝั่ง `client` เรียกดูใบแจ้งหนี้/สัญญาของห้องอื่นได้
4. **การหลุดมาตรฐานวิศวกรรมและดีไซน์:** การใช้สีหรือมุมโค้งนอกเหนือจาก [design.md](../../design.md), การใช้คำต้องห้ามที่ขัดกับ [CONTEXT.md](../../CONTEXT.md), หรือการเขียน `array.find()` จับคู่ Foreign Key บนฝั่ง Frontend
