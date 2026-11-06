# Environments, Configuration & Secrets Management — `tan-pms`

เอกสารนี้กำหนดมาตรฐานการแบ่งสภาพแวดล้อมรันระบบ (`Environments`) และการจัดการค่าความลับ (`Secrets`) ของ **`tan-pms`**

> อ้างอิงมาตรฐานการสังเกตการณ์ระบบจาก [observability-and-health.md](./observability-and-health.md)

---

## 1. สภาพแวดล้อมของระบบ (Standard Environments)

| สภาพแวดล้อม | วัตถุประสงค์ | ฐานข้อมูลและไฟล์แนบ |
|---|---|---|
| `Development` (`local`) | พัฒนาบนเครื่องนักพัฒนา | PostgreSQL ผ่าน Docker Compose + Local File Storage (`./.local-storage`) |
| `Staging` (`uat`) | ทดสอบครบวงจร (`PM-01`–`PM-10`) โดยทีมงานก่อนขึ้นระบบจริง | PostgreSQL แยกอิสระ + S3-compatible Private Bucket (ข้อมูลจำลอง ห้ามใช้ข้อมูลลูกค้าจริงที่ยังไม่ Anonymize) |
| `Production` (`prod`) | ใช้งานจริงสำหรับทุกสาขา (`Property`) ขององค์กร | Managed PostgreSQL (High Availability + Automated Backup) + Private Object Storage |

---

## 2. กฎการจัดการตัวแปรสภาพแวดล้อมและความลับ (Secrets Baseline)

1. **Zero Secrets in Git:**
   - ห้ามบันทึก Connection String จริง, JWT Signing Key, กุญแจเข้ารหัส PDPA (`PII_ENCRYPTION_KEY`), หรือ LINE OA / SMTP Credentials ลงใน Git เด็ดขาด
   - มีเฉพาะไฟล์ `.env.example` ที่ระบุชื่อตัวแปรและค่าตัวอย่างสำหรับ `Development` เท่านั้น
2. **Fail-Fast Configuration Validation on Startup:**
   - เมื่อ `TanPms.WebApi` เริ่มทำงาน ต้องตรวจสอบความครบถ้วนของ Configuration ด้วย `ValidateDataAnnotations()` และ `ValidateOnStart()` หากขาดค่าสำคัญ (เช่น `PII_ENCRYPTION_KEY` หรือ `ConnectionStrings:DefaultConnection`) แอปพลิเคชันต้องหยุดทำงานพร้อมแจ้งชื่อค่าที่ขาดทันที
3. **รายการตัวแปรสำคัญที่ต้องกำหนด:**
   - `ConnectionStrings__DefaultConnection`: PostgreSQL Connection String
   - `Security__JwtSigningKey`: กุญแจเซ็น Token (ความยาวอย่างน้อย 256 บิต)
   - `Security__PiiEncryptionKey`: กุญแจ AES-256 สำหรับเข้ารหัสเลขบัตรประชาชน/พาสปอร์ต
   - `Security__PiiBlindIndexKey`: กุญแจ HMAC-SHA256 สำหรับสร้าง `identity_hash`
   - `Storage__Provider` & `Storage__PrivateBucketName`: การตั้งค่าพื้นที่เก็บไฟล์แนบส่วนตัว
