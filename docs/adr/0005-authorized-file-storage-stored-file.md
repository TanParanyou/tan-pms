# ADR-0005: Authorized File Storage ด้วย `StoredFile` + Local-Disk Provider

## Status

Accepted — 2026-11-08

## Context

ระบบต้องรับไฟล์แนบจากทั้งฝั่ง `admin` และ `client`: รูปมิเตอร์ (`MeterPhoto`), สลิปโอนเงิน (`PaymentSlip`), รูปใบแจ้งซ่อม (`WorkOrderPhoto`), รูปพัสดุ (`ParcelPhoto`), รูปตรวจห้อง (`LeaseInspectionPhoto`) และสำเนาเอกสารยืนยันตัวตน (`IdentityDocument`) ซึ่งมี PII ตาม [pdpa-and-audit-redaction.md](../04-data/pdpa-and-audit-redaction.md) ก่อนหน้านี้ฟิลด์แนบไฟล์เก็บเป็นสตริง Key อิสระ (เช่น `slips/x.jpg`) โดยไม่มีการตรวจเจ้าของ/ชนิดไฟล์ และไม่มีเส้นทางดาวน์โหลดที่ตรวจสิทธิ์

## Decision

1. **Metadata อยู่ในตาราง `StoredFile`** (`TanPms.Domain/Files/StoredFile.cs`): `FileKey`, `Purpose` (`StoredFilePurpose`), `ContentType`, `SizeBytes`, `PropertyId`, `UploadedByUserId`, `UploadedByCustomerId`; Bytes อยู่ใน `IFileStorage` ภายใต้ `FileKey`
2. **`FileKey` สร้างโดยเซิร์ฟเวอร์เสมอ:** `Guid` รูปแบบ `N` (32 ตัวอักษร hex พิมพ์เล็ก) จึงไม่มีทางมี `/` หรือ `..`; `StoredFileRules.IsValidFileKey` ตรวจซ้ำทั้งที่ Handler และ `LocalDiskFileStorage`
3. **Local-Disk Provider** (`LocalDiskFileStorage`) เก็บใต้ `Storage:RootPath` (ค่าเริ่มต้น `<base>/App_Data/files`) โดยแตกโฟลเดอร์ด้วย 2 ตัวอักษรแรกของ Key; **ไม่เสิร์ฟไฟล์แบบ Static** — ดาวน์โหลดผ่าน `GET /api/v1/{admin|client}/files/{**fileKey}` เท่านั้น
4. **ตรวจชนิดไฟล์ด้วย Magic Bytes** (JPEG, PNG, WebP, PDF) ไม่เชื่อ `Content-Type` ที่ Client ส่งมา; จำกัดขนาด `10 MB` (อ่านเกินขีดจำกัดไป 1 byte แล้วปฏิเสธโดยไม่ buffer ทั้งไฟล์); ไฟล์ว่างถูกปฏิเสธ — ทุกกรณีตอบ `validation.failed`
5. **กฎสิทธิ์และความเป็นเจ้าของ:**
   - อัปโหลดฝั่ง `admin` ต้องมี `AllowedPropertyIds` ครอบ `propertyId` และมี Permission ของฟีเจอร์ที่ใช้ `purpose` นั้น (`StoredFileRules.AdminPermissionsFor`); ฝั่ง `client` อัปโหลดได้เฉพาะ `PaymentSlip` และ `WorkOrderPhoto`
   - ตอนเขียนข้อมูลที่อ้างไฟล์ (`ValidateAttachments`) ต้องเป็น Key ที่อัปโหลดผ่านระบบ, `purpose` ตรง, และเจ้าของถูกต้อง (admin: ไฟล์ของ `property` เดียวกันหรือไฟล์ที่ลูกค้าอัปโหลด; client: เฉพาะไฟล์ของ `CustomerId` ตนเอง)
   - ดาวน์โหลดฝั่ง `client` ต้องเป็นไฟล์ที่ลูกค้าอัปโหลดเองหรือถูกแนบกับเอกสารของลูกค้านั้น กรณี "ไม่มี" และ "ของคนอื่น" ตอบเหมือนกัน (`auth.permission_denied`) เพื่อกันการไล่เดา Key
   - Legacy Key ตอบ `file.not_found` (`404`) ไม่ใช่ `500`
6. **ดาวน์โหลดฝั่ง `admin`** (`GetAdminFileHandler`) ต้องเป็น Scope `admin` และเป็นผู้อัปโหลดเอง หรือไฟล์ผูกกับ `PropertyId` ที่อยู่ใน `AllowedPropertyIds` หรือไฟล์ถูกแนบกับ Entity ของสาขาที่เข้าถึงได้ มิฉะนั้นตอบ `auth.property_scope_denied` (Key ที่ไม่มี/รูปแบบผิด/Legacy ตอบ `file.not_found`)
7. **Audit:** การอัปโหลดฝั่ง `admin` บันทึก `AuditEvent` (`admin.files.upload`); `UploadClientFileHandler` ก็เรียก `RecordMutation` เช่นกัน (ตรวจพบการเรียก แต่ไม่ได้ตรวจ `actionKey` ที่ใช้)

## Consequences

- **ข้อดี:** ไม่มีไฟล์ที่เข้าถึงได้โดยไม่ผ่านการตรวจสิทธิ์, ปิดช่อง Path Traversal และการปลอมนามสกุล, เข้ากับ `useDeferredFileUpload` (อัปโหลดตอน Submit แล้วส่ง `fileKey` ไปกับคำสั่งหลัก)
- **ข้อจำกัด:** Local Disk ไม่ทน Multi-Instance/DR ต้องย้ายไป Private Object Storage ก่อน Production (ผ่าน `IFileStorage` โดยไม่เปลี่ยน Contract); ยังไม่มี Virus Scan, การลบไฟล์กำพร้า (Orphan Cleanup) และการเข้ารหัสไฟล์ที่ Rest; ไฟล์ Legacy ที่เคยเก็บเป็นสตริงดาวน์โหลดไม่ได้
- **Operational:** ต้อง Backup `Storage:RootPath` ควบคู่ฐานข้อมูล ดู [backup-restore-and-release.md](../06-operations/backup-restore-and-release.md)

## Alternatives Considered

- **Static file hosting ของ `wwwroot`/CDN:** ง่ายสุดแต่ข้ามการตรวจสิทธิ์ ไม่เหมาะกับไฟล์ PII — ปฏิเสธ
- **เก็บไฟล์ใน PostgreSQL (`bytea`):** ทรานแซกชันเดียวกับข้อมูล แต่ทำให้ฐานข้อมูลบวมและ Backup หนัก — ปฏิเสธในตอนนี้
- **Object Storage (S3-compatible) ตั้งแต่ต้น:** เหมาะ Production แต่เพิ่มความซับซ้อนช่วงพัฒนา — เก็บไว้เป็น Provider ถัดไปหลัง `IFileStorage`
- **ใช้ Content-Type/นามสกุลจาก Client:** ปลอมได้ง่าย — ปฏิเสธ
