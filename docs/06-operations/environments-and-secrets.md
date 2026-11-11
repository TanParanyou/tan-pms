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
   - `Auth__Mode` (`Jwt` ค่าเริ่มต้น | `Headers`): `Headers` อนุญาตเฉพาะ `Development`/`Testing` มิฉะนั้นระบบไม่ยอมเริ่มทำงาน
   - `Auth__Jwt__SigningKey`: กุญแจเซ็น Access Token (HS256) **บังคับนอก Development/Testing** ยาวอย่างน้อย 32 bytes (แนะนำสร้างด้วย `openssl rand -base64 48`) ห้าม Commit; ว่างหรือสั้นเกินไปทำให้ Start-up ล้มเหลว
   - `Auth__Jwt__Issuer` (`tan-pms`), `Auth__Jwt__Audience` (`tan-pms-web`), `Auth__Jwt__AccessTokenMinutes` (`15`), `Auth__Jwt__RefreshTokenDays` (`7`), `Auth__Jwt__RequireHttpsMetadata` (ค่าเริ่มต้น `true` นอก Dev/Testing, `false` ใน Dev/Testing)
   - `Auth__Lockout__Threshold` (`5`), `Auth__Lockout__Minutes` (`15`)
   - `Auth__RateLimit__Enabled` (`true`), `Auth__RateLimit__PermitLimit` (`10`), `Auth__RateLimit__WindowSeconds` (`60`): Fixed Window ต่อ IP บน `login`/`refresh`
   - `Seed__DevPassword`: รหัสผ่านของบัญชี Seed **เฉพาะ Dev/Testing** ห้ามตั้งใน Production (ถูกละเลยนอก Dev/Testing)
   - ค่าตัวเลขของ `Auth__*` ต้องเป็นจำนวนเต็มบวก ไม่เช่นนั้น Start-up ล้มเหลว
   - หมายเหตุ: `appsettings.json` มี Connection String เริ่มต้นสำหรับเครื่องพัฒนา (`postgres/postgres`) ต้อง Override ด้วย `ConnectionStrings__DefaultConnection` ในทุกสภาพแวดล้อมที่ Deploy
   - `Security__PiiEncryptionKey`: กุญแจ AES-256 สำหรับเข้ารหัสเลขบัตรประชาชน/พาสปอร์ต
   - `Security__PiiBlindIndexKey`: กุญแจ HMAC-SHA256 สำหรับสร้าง `identity_hash`
   - `Storage__RootPath`: โฟลเดอร์เก็บไฟล์แนบส่วนตัวของ Local-Disk Provider ที่ Backend อ่านจริง (`Storage__Provider`/`Storage__PrivateBucketName` เป็นค่าสงวน ยังไม่มีโค้ดอ่าน — ดู `.env.example`)

---

## Dev Login (เฉพาะ Development/Testing)

Backend ใน `Development` สร้างรหัสผ่านให้บัญชี Seed จากค่า `Seed:DevPassword` ใน `appsettings.Development.json` (เปิดอ่านค่าเองในไฟล์นั้น เอกสารนี้ไม่แสดงรหัสผ่าน):

| Scope (`scope` ใน `POST /api/v1/auth/login`) | Identifier |
|---|---|
| `admin` | `naphat.admin` (Organization Admin), `pimchanok.bkk` (แคชเชียร์ สาขา BKK), `kittisak.cnx` (ผู้จัดการ สาขา CNX) |
| `client` | `somchai@example.test`, `sudaawattana@example.test` |

ห้ามใช้บัญชีและรหัสผ่านนี้ใน Staging/Production
