# API Conventions & OpenAPI Contract Standards — `tan-pms`

เอกสารนี้กำหนดมาตรฐานการออกแบบ REST API, การแบ่งกลุ่ม URL, รูปแบบ Pagination/Filtering และการส่งข้อมูลแบบ Structured Projection ของ **`tan-pms`**

> อ้างอิงกฎการแยกกลุ่มผู้ใช้งานจาก [AGENTS.md](../../AGENTS.md) และมาตรฐานการตอบกลับข้อผิดพลาดจาก [error-contract.md](./error-contract.md)

---

## 1. โครงสร้าง URL และการแยกกลุ่มผู้ใช้งาน (`admin` vs `client`)

ทุก Endpoint ต้องขึ้นต้นด้วยเวอร์ชัน `/api/v1` และแยกตามกลุ่มผู้ใช้งานอย่างเคร่งครัด:

| กลุ่ม Endpoint | Prefix มาตรฐาน | ขอบเขตสิทธิ์ (Scope Filter) | ตัวอย่าง |
|---|---|---|---|
| **ฝั่งพนักงานและผู้บริหาร** | `/api/v1/admin/...` | `AdminScope` (`AllowedPropertyIds` + Permission Key) | `GET /api/v1/admin/properties/{propertyId}/units` |
| **ฝั่งลูกค้าและผู้เช่า** | `/api/v1/client/...` | `ClientScope` (`CustomerId == CurrentUser.CustomerId`) | `GET /api/v1/client/invoices` |
| **ระบบยืนยันตัวตน** | `/api/v1/auth/...` | Public / Refresh Token | `POST /api/v1/auth/login` |

---

## 2. มาตรฐานการส่งข้อมูลแบบ Structured Projection (ห้ามส่งเฉพาะ FK UUID)

เพื่อปฏิบัติตามกฎ **No Frontend `.find()` Foreign Key Resolution** ใน [AGENTS.md](../../AGENTS.md):
- API ที่คืนค่ารายการ (`List`) หรือรายละเอียด (`Detail`) **ต้อง** แนบข้อมูลอ้างอิงที่จำเป็นต่อการแสดงผลมาเป็นอ็อบเจกต์ย่อยเสมอ

```json
{
  "id": "0196a8e0-5b11-7a99-9a01-001122334455",
  "documentNumber": "BKK01-INV-2611-0042",
  "status": "Issued",
  "property": {
    "id": "0196a8d0-0001-7000-8000-000000000001",
    "code": "BKK01",
    "name": "TAN Residence Rama 9"
  },
  "unit": {
    "id": "0196a8d0-0002-7000-8000-000000000301",
    "unitNumber": "A-301",
    "buildingName": "Building A",
    "floorNumber": 3
  },
  "customer": {
    "id": "0196a8d0-0003-7000-8000-000000000088",
    "fullName": "สมชาย ใจดี",
    "maskedNationalId": "1-xxxx-xxxxx-12-3"
  },
  "subTotalAmount": 8500.00,
  "vatAmount": 140.00,
  "totalAmount": 8640.00
}
```

---

## 3. Pagination (Server-Side, Optional & Backward Compatible)

ตัดสินใจไว้ใน [ADR-0007](../adr/0007-server-side-pagination-contract.md) Endpoint รายการที่รองรับ (ผู้ใช้, ใบจอง, `Stay`, `Lease`, ใบแจ้งหนี้, กะแคชเชียร์, `DepositLedger`, คิวสลิป, งานแม่บ้าน, `WorkOrder`, `Parcel`, `LeaseIntent` และรายการฝั่ง `client`) ใช้ Query Parameters:

| Parameter | ชนิด | กฎ |
|---|---|---|
| `page` | `int?` | เริ่มที่ `1` (ค่าต่ำกว่า `1` ถูกปรับเป็น `1`) |
| `pageSize` | `int?` | ค่าเริ่มต้น `50` เมื่อส่ง `page` อย่างเดียว; ถูกบีบ (clamp) ให้อยู่ระหว่าง `1`–`200` โดยไม่ตอบ `400` |

- **ไม่ส่งทั้ง `page` และ `pageSize`** = พฤติกรรมเดิม คืนข้อมูลทั้งหมด และ `pagination` เป็น `null`
- Response คงโครงสร้างเดิมของรายการ (เช่น `items`) แล้วเพิ่มฟิลด์ `pagination` (Nullable):

```json
{
  "items": [],
  "pagination": { "page": 1, "pageSize": 50, "totalCount": 142, "totalPages": 3 }
}
```

- Backend ต้อง `OrderBy` ก่อนแบ่งหน้าเสมอเพื่อให้ลำดับเสถียร
- Filter เฉพาะรายการ (เช่น `status`, `stayMode`, `period`, `licensePlate`) เป็น Query Parameter ของแต่ละ Endpoint; ยังไม่มี `search`/`sortBy`/`sortDir` กลางที่ใช้ร่วมกันทุก Endpoint

---

## 4. ไฟล์แนบ (File Upload) และการดาวน์โหลดแบบ Binary

ตัดสินใจไว้ใน [ADR-0005](../adr/0005-authorized-file-storage-stored-file.md)

| Endpoint | หน้าที่ |
|---|---|
| `POST /api/v1/admin/files` | อัปโหลด (`multipart/form-data`: `propertyId`, `purpose`, `file`) ตอบ `201` พร้อม `StoredFileDto` (`fileKey`, `purpose`, `contentType`, `size`, `createdAt`) |
| `POST /api/v1/client/files` | อัปโหลดฝั่ง `client` (`purpose`, `file`) ผูกกับ `CustomerId` ปัจจุบัน |
| `GET /api/v1/{admin\|client}/files/{**fileKey}` | ดาวน์โหลด Binary ตาม `Content-Type` ที่ตรวจจาก Magic Bytes ตอนอัปโหลด หลังตรวจสิทธิ์/เจ้าของ |

- `purpose` (ไม่สนตัวพิมพ์): `MeterPhoto`, `PaymentSlip`, `WorkOrderPhoto`, `ParcelPhoto`, `LeaseInspectionPhoto`, `IdentityDocument`; ฝั่ง `client` ใช้ได้เฉพาะ `PaymentSlip` และ `WorkOrderPhoto`; ฝั่ง `admin` ต้องมี Permission ของฟีเจอร์ที่ใช้ `purpose` นั้น
- **ข้อจำกัด:** ขนาดไม่เกิน `10 MB`, ไม่ว่าง, ชนิดที่รับ `image/jpeg`, `image/png`, `image/webp`, `application/pdf` (ตรวจจาก Magic Bytes ไม่เชื่อ Content-Type ของ Client); ผิดกฎตอบ `validation.failed` (`400`)
- **`fileKey`** คือ Guid รูปแบบ `N` 32 ตัวอักษร hex ที่เซิร์ฟเวอร์สร้างเท่านั้น; ฟิลด์ `*FileKey` ในคำสั่งอื่นต้องอ้าง Key ที่อัปโหลดแล้วตรง `purpose` และเจ้าของ (ว่าง/`null` ยังรับได้)
- ฝั่ง Frontend ต้องอัปโหลดตอน Submit ผ่าน `useDeferredFileUpload` แล้วส่ง `fileKey` ไปกับคำสั่งหลัก
- **Endpoint ที่ตอบ PDF (`application/pdf`)** ตัดสินใจไว้ใน [ADR-0006](../adr/0006-pdf-generation-questpdf-sarabun.md): `GET /api/v1/admin/properties/{propertyId}/leases/{leaseId}/contract.pdf`, `GET /api/v1/admin/properties/{propertyId}/receipts/{receiptId}/pdf`, `GET /api/v1/client/receipts/{receiptId}/pdf` (รายการใบเสร็จเป็น JSON ที่ `GET .../receipts`) ความล้มเหลวยังตอบเป็น `application/problem+json` ตาม [error-contract.md](./error-contract.md)
- Binary/PDF ไม่ผ่าน JSON Envelope: Frontend ต้องดึงด้วย `ApiClient` ที่รองรับ Blob ไม่ใช่ `fetch` ดิบใน `useEffect`

---

## 5. Cancel / Void และ `ReasonRequest`

ตามนโยบายใน [ADR-0010](../adr/0010-delete-cancel-void-policy.md) การยกเลิกเอกสารที่มีผลต่อเนื่องเป็น `POST` แยกต่างหาก ไม่ใช้ `DELETE`:

```json
{ "reason": "ลูกค้าแจ้งยกเลิก" }
```

- Body `ReasonRequest { reason: string }` — `reason` ว่างตอบ `validation.failed` (`400`) และเหตุผลถูกบันทึกใน `AuditEvent`
- Endpoint ปัจจุบัน: `.../reservations/{id}/cancel` (admin) และ `/client/reservations/{id}/cancel`, `.../stays/{id}/cancel`, `.../leases/{id}/cancel`, `.../invoices/{id}/void`, `.../cashier/shifts/{id}/cancel`, `.../work-orders/{id}/cancel` (ทั้ง 2 ฝั่ง), `.../parcels/{id}/void`, `.../stays/{id}/folio/charges/{chargeId}/void`, `.../lease-intents/{id}/reject`, `/users/{id}/deactivate` (บาง Endpoint ใช้ Body อื่นที่มีเหตุผลในตัว เช่น `folio/payments/reverse` — ดู OpenAPI)
- `DELETE` ใช้เฉพาะ Hard/Soft Delete ของข้อมูลที่ยังไม่มีผลทางการเงิน (เช่น Draft Invoice, `HousekeepingTask`, Master Data ที่ไม่ถูกอ้างอิง)

---

## 6. OpenAPI Single Source of Truth, Naming และ Additive Change Policy

- ไฟล์สัญญาหลักอยู่ที่ `contracts/openapi/tan-pms.v1.json` (OpenAPI `3.0.3`, `info.version` `1.0.0`) และเป็นไฟล์ที่ดูแลด้วยมือควบคู่ `Program.cs` — ทุกครั้งที่แก้ Endpoint/DTO ใน `TanPms.WebApi` ต้องอัปเดตไฟล์นี้ให้ตรงในรอบเดียวกัน แล้วรัน `npm run generate:api` ใน `frontend/` เพื่อสร้าง `frontend/src/generated/api/tan-pms.v1.ts`
- **`operationId`:** `camelCase` รูปแบบ `<verb><Scope><Resource>` เช่น `getAdminRoomRack`, `uploadAdminFile`, `updateAdminBillingSettings`, `logoutAuthSession` (ฝั่ง `client` ใช้ `Client` แทน `Admin`) และต้องไม่ซ้ำกันทั้งไฟล์
- **`tags`:** ขึ้นต้น `Admin`/`Client`/`Auth`/`Health` ตามกลุ่ม URL แล้วตามด้วยโมดูล (เช่น `AdminBilling`, `ClientFiles`) หมายเหตุ: ปัจจุบันมี Tag ที่ซ้ำความหมาย (เช่น `AdminLease`/`AdminLeases`, `AdminMeter`/`AdminMeters`) ควรรวมในรอบ Contract ถัดไป
- **Additive Change Policy (ภายใน `v1`):** อนุญาตเฉพาะการเพิ่ม Endpoint, ฟิลด์ Response, ฟิลด์ Request ที่ Optional, Query Parameter ที่ Optional และค่า Enum ใหม่ที่ Client เดิมรับมือได้ (เช่น `pagination` Nullable ตาม ADR-0007) ห้ามเปลี่ยนชื่อ/ชนิด/ลบฟิลด์ เปลี่ยนความหมาย Status Code หรือทำฟิลด์เดิมเป็น Required — การเปลี่ยนแบบ Breaking ต้องผ่าน `/api/v2` หรือประกาศ Deprecation พร้อมระยะเปลี่ยนผ่าน และบันทึกใน ADR
- ผลตรวจสัญญา: Frontend ใช้ Type จากไฟล์ Generated เท่านั้น ห้ามประกาศ DTO ซ้ำด้วยมือ
