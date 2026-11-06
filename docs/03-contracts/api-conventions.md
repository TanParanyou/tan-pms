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

## 3. รูปแบบ Pagination, Sorting และ Filtering

สำหรับ Endpoint ที่คืนค่ารายการตาราง ใช้ Query Parameters มาตรฐาน:
- `page` (เริ่มที่ `1`), `pageSize` (ค่าเริ่มต้น `20`, สูงสุด `100`)
- `search` (ค้นหาด้วยรหัสเอกสาร, เลขห้อง, ชื่อลูกค้า หรือป้ายทะเบียนรถ)
- `sortBy` และ `sortDir` (`asc` | `desc`)

โครงสร้าง JSON Response สำหรับตาราง:
```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 142,
  "totalPages": 8
}
```

---

## 4. OpenAPI Single Source of Truth

- ไฟล์สัญญาหลักอยู่ที่ `contracts/openapi/tan-pms.v1.json`
- ทุกครั้งที่มีการแก้ไข Controller/Endpoint หรือ DTO ใน `TanPms.WebApi` ต้องอัปเดต `tan-pms.v1.json` และรันคำสั่งสร้าง TypeScript Types ไปยัง `frontend/src/generated/api/schema.d.ts`
