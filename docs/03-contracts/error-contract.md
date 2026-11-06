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
| `validation.failed` | `400` | ข้อมูลในฟอร์มไม่ผ่านเกณฑ์ (ดูรายละเอียดรายฟิลด์ใน `errors`) |
| `auth.unauthenticated` | `401` | ไม่ได้เข้าสู่ระบบหรือ Token หมดอายุ |
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
