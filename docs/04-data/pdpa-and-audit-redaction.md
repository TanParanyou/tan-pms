# PDPA Data Protection, PII Masking & Audit Redaction — `tan-pms`

เอกสารนี้กำหนดมาตรฐานการคุ้มครองข้อมูลส่วนบุคคล (PDPA), การปกปิดข้อมูลสำคัญ (PII Masking), การจัดเก็บไฟล์แนบส่วนตัว และการบันทึกประวัติการกระทำสำคัญ (`AuditEvent`) ของ **`tan-pms`**

> อ้างอิงสิทธิ์การเข้าถึงจาก [permission-catalog.md](../03-contracts/permission-catalog.md)

---

## 1. การจัดเก็บและปกปิดข้อมูลส่วนบุคคล (`PDPA` & `PII Masking`)

ข้อมูลลูกค้า (`Customer`) และผู้พักอาศัย (`Occupant`) มีข้อมูลอ่อนไหวสำหรับการทำสัญญาเช่าและรายงาน ร.ร.4 / ตม.30 ได้แก่ เลขประจำตัวประชาชน 13 หลัก และหมายเลขหนังสือเดินทาง (Passport Number):

1. **Application-Level Encryption & Blind Index:**
   - คอลัมน์ `national_id_encrypted` และ `passport_no_encrypted` ต้องเข้ารหัสด้วย AES-256-GCM ก่อนบันทึกลงฐานข้อมูล
   - เก็บค่า `identity_hash` (HMAC-SHA256) แยกอีกคอลัมน์เพื่อใช้ค้นหาลูกค้าเดิมโดยไม่ต้องถอดรหัสทั้งตาราง
2. **Default Masking (`1-xxxx-xxxxx-12-3`):**
   - ทุก API Response ทั้งฝั่ง `admin` และ `client` ต้องส่งค่าที่ผ่านการ Masking แล้วเป็นค่าเริ่มต้น เช่น เลขบัตรประชาชนแสดงเป็น `1-xxxx-xxxxx-12-3` และหมายเลขพาสปอร์ตแสดงเฉพาะ 3 ตัวท้าย
   - การขอดูเลขเต็มสามารถทำได้เฉพาะ Endpoint พิเศษที่ตรวจสิทธิ์ `admin.customer.unmask_pii` และต้องบันทึกลง `AuditEvent` ทุกครั้งที่เปิดดู

---

## 2. การกรองข้อมูลความลับออกจากระบบบันทึก (`Log Redaction`)

ห้ามบันทึกข้อมูลต่อไปนี้ลงใน Application Logs (`Serilog` / Structured JSON Logs) เด็ดขาด:
- เลขบัตรประชาชนเต็ม, หมายเลขหนังสือเดินทางเต็ม
- รหัสผ่าน (`password`), `accessToken`, `refreshToken`, Cookie หรือ API Key
- ข้อมูลหน้าบัตรเครดิตหรือเลขบัญชีธนาคารเต็ม

ระบบต้องกำหนด `RedactingEnricher` ใน Backend เพื่อแทนที่ฟิลด์ต้องห้ามด้วย `[REDACTED]` อัตโนมัติ

---

## 3. การควบคุมไฟล์แนบส่วนตัว (`Private File Storage`)

ไฟล์แนบทุกชนิดใน `tan-pms` (รูปถ่ายบัตรประชาชน, สัญญาเช่า, สลิปโอนเงิน, รูปถ่ายมิเตอร์น้ำ-ไฟ, รูปแจ้งซ่อม และรูปพัสดุ):
1. **No Public Bucket URLs:** ห้ามเปิดโฟลเดอร์หรือ Object Storage Bucket เป็น Public Read เด็ดขาด
2. **Authorized File Streaming:** การดาวน์โหลดหรือแสดงรูปภาพต้องเรียกผ่าน `/api/v1/admin/files/{fileId}` (ตรวจ `AdminScope`) หรือ `/api/v1/client/files/{fileId}` (ตรวจ `ClientScope` ว่าไฟล์นั้นเป็นของ `CustomerId` ที่ล็อกอินอยู่จริง)
3. **Deferred Upload Only:** ฝั่ง Frontend ต้องใช้ `useDeferredFileUpload` เพื่อป้องกันไฟล์ขยะค้างในระบบจากฟอร์มที่ผู้ใช้กดยกเลิก

---

## 4. ตารางบันทึกการกระทำที่มีความเสี่ยงสูง (`AuditEvent`)

นอกเหนือจากฟิลด์ `created_by` / `updated_by` บนทุกตารางแล้ว การกระทำที่มีผลกระทบทางการเงินหรือความปลอดภัยต่อไปนี้ต้องเขียนแถวใหม่ลงตาราง `audit_events` (`AuditEvent` แบบ Append-Only ห้ามแก้ไขหรือลบ) พร้อมระบุ `reason`, `before_json` และ `after_json`:

- การเปิดห้องพักที่มีสถานะ `Dirty` (`admin.stay.override_dirty_checkin`)
- การแก้ไขเลขมิเตอร์หลังจากออกบิลแล้ว (`admin.meters.override_locked`)
- การยกเลิกใบแจ้งหนี้หรือใบเสร็จรับเงิน (`admin.invoices.void`)
- การอนุมัติคืนเงินประกันสัญญาเช่า (`admin.leases.settle_moveout`)
- การกระทบยอดกะแคชเชียร์ที่มีผลต่างเงินสด (`admin.cashier.reconcile_shift`)
- การกดเปิดดูเลขบัตรประชาชน/พาสปอร์ตเต็ม (`admin.customer.unmask_pii`)
