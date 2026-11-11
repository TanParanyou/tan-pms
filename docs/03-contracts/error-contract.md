# Error Contract (RFC 9457 Problem Details) — `tan-pms`

เอกสารนี้กำหนดมาตรฐานการส่งคืนข้อผิดพลาดของ API ทั้งหมดใน **`tan-pms`** ตามมาตรฐาน **RFC 9457 Problem Details for HTTP APIs**

> อ้างอิงข้อกำหนดจาก [AGENTS.md](../../AGENTS.md) และสถานะเอกสารจาก [CONTEXT.md](../../CONTEXT.md)

---

## 1. โครงสร้างมาตรฐาน RFC 9457 Problem Details

ทุก HTTP Response ที่มีสถานะ `4xx` หรือ `5xx` ต้องใช้ `Content-Type: application/problem+json` และมีฟิลด์ขยาย `errorCode` และ `traceId` เสมอ (ห้ามส่ง Stack Trace ออกไปใน Production):

```json
{
  "type": "https://tan-pms.internal/errors/unit.not_clean",
  "title": "Unit condition is not clean for check-in",
  "status": 409,
  "detail": "Unit A-301 is currently in Dirty status and cannot be checked in without override permission.",
  "instance": "/api/v1/admin/stays/check-in",
  "errorCode": "unit.not_clean",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "errors": {}
}
```

---

## 2. ตารางรหัสข้อผิดพลาดมาตรฐาน (`errorCode` Catalog)

Frontend ต้องใช้ค่า `errorCode` ในการแปลข้อความแจ้งเตือนผ่าน `messages/th.json` และ `messages/en.json`:

| `errorCode` | HTTP Status | ความหมายและการเกิดข้อผิดพลาด |
|---|---|---|
| `validation.failed` | `400` | ข้อมูลไม่ผ่านเกณฑ์ เช่น ฟิลด์บังคับว่าง, `ReasonRequest.reason` ว่าง, `purpose`/ชนิดไฟล์/ขนาดไฟล์เกิน 10 MB ไม่ถูกต้อง, `fileKey` ที่ไม่ใช่รูปแบบ 32 ตัวอักษร hex, หรือไฟล์แนบที่ไม่ได้อัปโหลดผ่าน File Endpoint ตรง `purpose` |
| `localized_text.thai_required` | `400` | `LocalizedText` ไม่มีค่าภาษาไทย (`th` ว่างหรือเป็นช่องว่าง) ตาม [ADR-0004](../adr/0004-localized-jsonb-for-master-data-text.md) |
| `localized_text.too_long` | `400` | ข้อความใน `LocalizedText` (`th` หรือ `en`) ยาวเกินความยาวสูงสุดที่กำหนด |
| `auth.unauthenticated` | `401` | ไม่ได้เข้าสู่ระบบหรือ Token หมดอายุ |
| `auth.invalid_credentials` | `401` | `POST /api/v1/auth/login` ด้วย Identifier/Password ไม่ถูกต้อง (ข้อความ Detail: "identifier or password is invalid" ไม่แยกว่าผิดที่ส่วนใด; รวมกรณีผู้ใช้ถูกล็อก (Lockout) และบัญชีไม่ Active เพื่อไม่เปิดเผยสถานะบัญชี) |
| `auth.property_scope_denied` | `403` | พนักงานฝั่ง `admin` พยายามเข้าถึง `PropertyId` ที่ไม่อยู่ใน `AllowedPropertyIds` |
| `auth.permission_denied` | `403` | ไม่มีสิทธิ์ตาม Permission Key ที่กำหนดสำหรับคำสั่งนั้น |
| `unit.not_clean` | `409` | พยายามทำรายการ Check-in เข้า `Unit` ที่ `ConditionStatus` ไม่ใช่ `Clean` โดยไม่มีสิทธิ์ Override |
| `reservation.slot_overlap` | `409` | ช่วงเวลาที่ขอจองหรือเปิดห้องทับซ้อนกับ `Stay`, `Lease` หรือ `Reservation` อื่นใน `tstzrange` |
| `reservation.quota_exhausted` | `409` | โควตาห้องว่างของ `UnitType` ในช่วงเวลาดังกล่าวเต็มแล้ว |
| `reservation.hold_expired` | `409` | ใบจองสถานะ `Hold` หมดเวลา `HoldExpiresAt` (เกิน 15 นาที) ก่อนแนบสลิปชำระเงิน |
| `stay.folio_unsettled` | `409` | พยายามทำรายการ `CheckOut` ขณะที่ยังมียอดค้างชำระหรือเงินมัดจำกุญแจที่ยังไม่จัดการใน `Folio` |
| `invoice.immutable_status` | `409` | พยายามแก้ไขหรือลบ `Invoice` ที่อยู่ในสถานะ `Issued` หรือ `Paid` แล้ว (ต้องใช้คำสั่ง `Void` เท่านั้น) |
| `shift.not_open` | `409` | พนักงานพยายามรับหรือจ่ายเงินสดโดยยังไม่มี `CashierShift` สถานะ `Open` ของตนเอง |
| `meter.rollover_unconfirmed` | `409` | เลขมิเตอร์ปัจจุบันน้อยกว่าเลขมิเตอร์ครั้งก่อนหน้า โดยยังไม่ได้กดยืนยันสถานะ `IsRolloverConfirmed` |
| `master_data.in_use` | `409` | ลบ Master Data (`Building`, `Floor`, `UnitType`, `Unit`, `RatePlan`, `UtilityTariff`, `TaxProfile` ฯลฯ) ที่ยังมีข้อมูลอ้างอิงใช้งาน (`PropertyCatalogRules`) และใช้กับกฎ "ห้ามปิดใช้งาน/ลดสิทธิ์ `OrganizationAdmin` คนสุดท้ายที่ยังใช้งานอยู่" (`IdentityRules`) ตาม [ADR-0010](../adr/0010-delete-cancel-void-policy.md) |
| `file.not_found` | `404` | ไม่พบไฟล์ตาม `fileKey` ในที่เก็บไฟล์ หรือเป็น Legacy Key (เช่น `slips/x.jpg`) ที่ดาวน์โหลดผ่าน File Service ไม่ได้ (ไฟล์ของลูกค้าอื่นที่ฝั่ง `client` ไม่มีสิทธิ์เห็นจะตอบเป็น `auth.permission_denied` เพื่อไม่ให้เดา key ได้) |
| `internal.unexpected_error` | `500` | Fallback ของ `ProblemDetailsMapper` เมื่อ `Error.Code` ว่างหรือไม่อยู่ในตาราง (ไม่ได้ประกาศใน `DomainErrorCodes`; มี `Title`/`Detail` ใน `.resx`) |

### 2.1 รหัส `auth.*` ของระบบยืนยันตัวตน (JWT)

ตามที่กำหนดใน [ADR-0011](../adr/0011-authentication-with-own-jwt.md):

| `errorCode` | HTTP Status | ความหมายและการเกิดข้อผิดพลาด |
|---|---|---|
| `auth.password_policy` | `400` | รหัสผ่านใหม่ (`change-password`, `reset-password`, สร้างบัญชีลูกค้า) ยาวไม่อยู่ในช่วง 10–256 ตัวอักษรหรือเป็นช่องว่างล้วน |
| `auth.refresh_token_invalid` | `401` | `POST /api/v1/auth/refresh` ด้วย Refresh Token ที่ไม่พบ, หมดอายุ, ถูกเพิกถอน, เคยถูกหมุนไปแล้ว (ใช้ซ้ำ = เพิกถอนทั้ง Family) หรือเจ้าของบัญชีไม่ Active — Frontend ต้องบังคับ Login ใหม่ |
| `auth.rate_limited` | `429` | เกินโควตาต่อ IP บน `POST /auth/login` หรือ `/auth/refresh` (ค่าเริ่มต้น 10 ครั้ง/60 วินาที) พร้อม Header `Retry-After` (วินาที) |

**ความหมาย 401 กับ 403 (โหมด `Jwt`):**

- **`401`** (`auth.unauthenticated`): ไม่มี Bearer Token, Token ไม่ถูกต้อง/หมดอายุ/ลายเซ็นผิด, หรือผู้ใช้ถูก Deactivate/ไม่พบ (Token ที่ยังไม่หมดอายุของผู้ใช้ที่ปิดใช้งานก็เป็น `401`); `auth.invalid_credentials` และ `auth.refresh_token_invalid` เป็น `401` เช่นกัน
- **`403`**: Scope ใน Token ไม่ตรงกลุ่ม Route (เช่น Token `client` เรียก `/api/v1/admin/...` = `auth.permission_denied`), ไม่มี Permission Key, หรือ `PropertyId` นอก `AllowedPropertyIds` (`auth.property_scope_denied`)
- **Header `WWW-Authenticate: Bearer`:** `ProblemDetailsMapper.ToProblemResult` ตั้ง Header นี้ทุกครั้งที่ Status เป็น `401` (ตรวจแล้วที่ `backend/src/TanPms.WebApi/ErrorHandling/ProblemDetailsMapper.cs`) Client ยังควรอาศัย `errorCode` และ Status เป็นหลัก

### 2.2 กฎการแมป Status และข้อความ (Source of Truth ในโค้ด)

- **Status:** `ProblemDetailsMapper.GetStatus(code)` (`backend/src/TanPms.WebApi/ErrorHandling/ProblemDetailsMapper.cs`) เป็นเจ้าของตารางแมป `errorCode` -> HTTP Status; รหัสที่ไม่รู้จักตอบ `500`
- **ข้อความ 2 ภาษา:** ดึงจาก `Resources/Errors.resx` (`th`) และ `Resources/Errors.en.resx` (`en`) ด้วยคีย์ `<errorCode>_TITLE` และ `<errorCode>_DETAIL` โดยเลือกภาษาจาก Header `Accept-Language` (ขึ้นต้นด้วย `en` = อังกฤษ มิฉะนั้นไทย) หากไม่มี `_DETAIL` จะใช้ `Error.Message` จากโค้ด
- **Domain Exception:** `DomainRuleException` ถูกแปลงเป็น Problem Details โดย `ProblemDetailsExceptionHandler` โดยใช้เฉพาะ `ErrorCode` + `Message` แล้วหา Status จาก `GetStatus` (ค่า `HttpStatus` ใน Exception ไม่ถูกใช้ตัดสิน Status ตอบกลับ) ส่วน Exception อื่นตอบ `internal.unexpected_error` `500`
- **การเพิ่มรหัสใหม่:** ต้องเพิ่มค่าคงที่ใน `DomainErrorCodes.cs`, เคส `GetStatus`, คีย์ `_TITLE`/`_DETAIL` ในทั้ง 2 `.resx`, แถวในตารางนี้ และ i18n ฝั่ง Frontend ให้ครบในรอบเดียว
