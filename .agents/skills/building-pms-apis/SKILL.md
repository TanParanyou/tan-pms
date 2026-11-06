---
name: building-pms-apis
description: คู่มือและมาตรฐานสถาปัตยกรรมและการสร้าง API แบบ End-to-End สำหรับโปรเจกต์ tan-pms ครอบคลุม .NET 10 Clean Architecture (Vertical Feature Folders, One Type Per File, Result<T> Pattern), AdminScope & ClientScope Isolation, RFC 9457 Problem Details พร้อม Localized .resx, Structured Projections, OpenAPI Contract Generation และ Central ApiClient
---

# Building PMS APIs (`tan-pms` End-to-End API Standards)

## 1. Clean Architecture & Vertical Feature Folders
```text
TanPms.WebApi ───────► TanPms.Application ───────► TanPms.Domain
     │                        ▲                        ▲
     └── composition ─────────┴── TanPms.Infrastructure
```
- **One Public Type Per File:** ห้ามรวมหลาย Entity, Enum หรือ Service ไว้ในไฟล์เดียว ต้องแยกโฟลเดอร์ตามหมวดธุรกิจ (`Common/`, `DocumentNumbering/`, `Properties/`, `Customers/`, `Rates/`, `Reservations/`, `Stays/`, `Leases/`, `Meters/`, `Billing/`, `Cashier/`, `Operations/`, `Rack/`, `ClientPortal/`)
- **`Result<T>` & `Error` Pattern:** Use Case Handlers ใน `TanPms.Application` คืนค่า `Result<T>` (`IsSuccess`, `IsFailure`, `Value`, `Error`) แทนการโยน Exception สำหรับ Flow ธุรกิจปกติ และแปลงเป็น RFC 9457 ผ่าน `ProblemDetailsMapper`

## 2. Dual-Scope Isolation (`AdminScope` vs `ClientScope`)
- **`/api/v1/admin/...` (`AdminScope`):** ตรวจสอบว่า `propertyId` อยู่ใน `AllowedPropertyIds` และผู้ใช้มี Permission Key ที่กำหนด
- **`/api/v1/client/...` (`ClientScope`):** บังคับกรองข้อมูลด้วย `CustomerId == CurrentUser.CustomerId` จากบริบทผู้ใช้เสมอ ห้ามรับ `customerId` จาก Query/Body มาค้นหาข้อมูลข้ามคน

## 3. RFC 9457 Problem Details & `.resx` Localization
- ทุก Error Response ใช้ `application/problem+json` ตามโครงสร้าง `ApiProblemDetails` (`type`, `title`, `status`, `detail`, `instance`, `code`, `errorCode`, `traceId`, `errors`)
- ข้อความ `Title` และ `Detail` ดึงจาก `Resources/Errors.resx` (ภาษาไทย) และ `Resources/Errors.en.resx` (ภาษาอังกฤษ) ตาม `Accept-Language`

## 4. OpenAPI & Frontend Consumption
- สัญญา API อยู่ที่ `contracts/openapi/tan-pms.v1.json` และสร้าง TypeScript Types ด้วย `npm run generate:api` ไปยัง `frontend/src/generated/api/tan-pms.v1.ts`
- Frontend เรียกผ่าน `src/lib/api/api-client.ts` (`ApiClient`) และแปลงข้อผิดพลาดเป็น `ApiError` โดยตรวจสอบจาก `error.errorCode` เสมอ

## 5. Localized `jsonb` Text Contract (`LocalizedText` & `LocalizedTextDto`)
- **Domain Value Object (`TanPms.Domain/Common/LocalizedText.cs`):** ใช้ `LocalizedText` (`[JsonPropertyName("th")] string Thai`, `[JsonPropertyName("en")] string? English`) สำหรับชื่อและคำอธิบายหลายภาษาของ Master Data (`Property`, `Building`, `Floor`, `UnitType`, `UnitAsset`, `HourlyRateRule`) และ Snapshot รายการในบิล (`FolioCharge.Description`, `InvoiceLine.Description`) โดยบังคับว่า `Thai` (`th`) ห้ามว่าง (`localized_text.thai_required`)
- **EF Core `jsonb` Mapping:** ใน `TanPmsDbContext` ใช้ `ValueConverter<LocalizedText, string>` แปลงเป็น `.HasColumnType("jsonb")` เก็บในรูปแบบ `{"th": "...", "en": "..."}`
- **API Projection (`LocalizedTextDto`):** ส่งออกผ่าน OpenAPI Contract เป็น `LocalizedTextDto` (`{ th: string, en?: string | null }`) เพื่อให้ Frontend แสดงผลตามภาษาที่เลือกผ่าน `resolveLocalizedText(dto, locale)` (`src/lib/i18n/localized-text.ts`)
