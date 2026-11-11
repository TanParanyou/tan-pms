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
| `auth.invalid_credentials` | `401` | `POST /api/v1/auth/login` ด้วย Identifier/Password ไม่ถูกต้อง (ข้อความ Detail: "identifier or password is invalid" ไม่แยกว่าผิดที่ส่วนใด; ตรรกะการยืนยันตัวตนจริงอยู่ระหว่างพัฒนาในรอบถัดไป) |
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

### 2.1 ตำแหน่งสงวนสำหรับรหัส `auth.*` ชุดใหม่ (Reserved for Authentication Pass)

<!-- AUTH-ERROR-CODES-PLACEHOLDER: รอบถัดไปเพิ่มรหัสข้อผิดพลาดของระบบยืนยันตัวตนจริง (เช่น Token/Refresh/Lockout) ในตารางนี้ ห้ามเพิ่มรหัสก่อนมีใน DomainErrorCodes.cs -->

| `errorCode` | HTTP Status | ความหมายและการเกิดข้อผิดพลาด |
|---|---|---|
| _(ยังไม่มี — จะเพิ่มในรอบถัดไป)_ | — | — |

### 2.2 กฎการแมป Status และข้อความ (Source of Truth ในโค้ด)

- **Status:** `ProblemDetailsMapper.GetStatus(code)` (`backend/src/TanPms.WebApi/ErrorHandling/ProblemDetailsMapper.cs`) เป็นเจ้าของตารางแมป `errorCode` -> HTTP Status; รหัสที่ไม่รู้จักตอบ `500`
- **ข้อความ 2 ภาษา:** ดึงจาก `Resources/Errors.resx` (`th`) และ `Resources/Errors.en.resx` (`en`) ด้วยคีย์ `<errorCode>_TITLE` และ `<errorCode>_DETAIL` โดยเลือกภาษาจาก Header `Accept-Language` (ขึ้นต้นด้วย `en` = อังกฤษ มิฉะนั้นไทย) หากไม่มี `_DETAIL` จะใช้ `Error.Message` จากโค้ด
- **Domain Exception:** `DomainRuleException` ถูกแปลงเป็น Problem Details โดย `ProblemDetailsExceptionHandler` โดยใช้เฉพาะ `ErrorCode` + `Message` แล้วหา Status จาก `GetStatus` (ค่า `HttpStatus` ใน Exception ไม่ถูกใช้ตัดสิน Status ตอบกลับ) ส่วน Exception อื่นตอบ `internal.unexpected_error` `500`
- **การเพิ่มรหัสใหม่:** ต้องเพิ่มค่าคงที่ใน `DomainErrorCodes.cs`, เคส `GetStatus`, คีย์ `_TITLE`/`_DETAIL` ในทั้ง 2 `.resx`, แถวในตารางนี้ และ i18n ฝั่ง Frontend ให้ครบในรอบเดียว
