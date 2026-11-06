# Backup, Restore & Release Readiness — `tan-pms`

เอกสารนี้กำหนดนโยบายการสำรองและกู้คืนข้อมูล (`Backup & Restore`) รวมถึงขั้นตอนตรวจสอบความพร้อมก่อนปล่อยเวอร์ชันใหม่ (`Release Readiness`) ของ **`tan-pms`**

> อ้างอิงเกณฑ์ความพร้อมของระบบจาก [development-ready-gate.md](../05-engineering/development-ready-gate.md)

---

## 1. นโยบายการสำรองข้อมูลและเป้าหมายการกู้คืน (`RPO` / `RTO`)

เนื่องจาก `tan-pms` เก็บข้อมูลสัญญาเช่า (`Lease`), ใบแจ้งหนี้ (`Invoice`), ใบเสร็จรับเงิน (`Receipt`), ทะเบียนเงินประกัน (`DepositLedger`) และกะแคชเชียร์ (`CashierShift`):

- **Recovery Point Objective (RPO):** ไม่เกิน **15 นาที** (ใช้ PostgreSQL Continuous WAL Archiving / Point-in-Time Recovery ร่วมกับการสำรองฐานข้อมูลเต็มรูปแบบทุกวันเวลา 03:00 น. ตามเวลา `Asia/Bangkok`)
- **Recovery Time Objective (RTO):** ไม่เกิน **60 นาที** สำหรับการกู้คืนฐานข้อมูลและบริการหลักกลับมาทำงาน
- **Private File Storage Backup:** ไฟล์สลิปโอนเงิน สัญญาเช่า และรูปมิเตอร์ใน `IFileStorage` ต้องเปิด Object Versioning และสำรองข้ามโซนทุกวัน

---

## 2. การซ้อมกู้คืนข้อมูลประจำไตรมาส (`Restore Drill`)

การสำรองข้อมูลจะถือว่าสมบูรณ์ก็ต่อเมื่อทดสอบกู้คืนได้จริง:
1. นำ Backup ล่าสุดมารันในสภาพแวดล้อมแยก (`Restore Sandbox`)
2. ตรวจสอบว่าตาราง `invoices`, `receipts`, `deposit_transactions`, `leases` และดัชนี `EXCLUDE USING gist` บน `unit_availability_slots` ทำงานได้ครบถ้วน
3. ตรวจสอบว่าสามารถถอดรหัสข้อมูลที่ผ่านการ Masking และเปิดไฟล์แนบจำลองได้ถูกต้อง

---

## 3. รายการตรวจสอบก่อนปล่อยเวอร์ชันขึ้นระบบจริง (`Release Readiness Checklist`)

1. **Database Migrations Safe for Zero/Low Downtime:**
   - ตรวจสอบสคริปต์ EF Core Migration ว่าไม่มีคำสั่ง `DROP COLUMN` หรือ `DROP TABLE` ที่ทำลายข้อมูลการเงินเดิมโดยไม่ได้สำรองก่อน
   - ยืนยันว่า Extension `btree_gist` ถูกติดตั้งในฐานข้อมูลปลายทางแล้ว
2. **Contract & Localization Parity:**
   - ยืนยันว่า `contracts/openapi/tan-pms.v1.json` ตรงกับ Backend และไฟล์ `th.json` / `en.json` มีคีย์ครบตรงกัน 100%
3. **Automated Gate Verification:**
   - รัน `npm run verify:docs`, ชุดทดสอบ Backend (`ArchitectureTests`, `UnitTests`, `IntegrationTests`) และชุดทดสอบ Frontend ผ่านครบทุกข้อก่อนกด Deploy
