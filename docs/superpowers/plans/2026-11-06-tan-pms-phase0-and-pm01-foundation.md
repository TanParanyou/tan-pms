# tan-pms Phase 0 & PM-01..PM-10 Core Vertical Foundation Plan (Tiered Orchestration)

> **Orchestration Mode:** `tiered-orchestration`
> - **Backend Track (`backend/`):** `Role: "Backend Domain Architect"`, `Model: "inherit"`
> - **Frontend Track (`frontend/`):** `Role: "Frontend UI Specialist"`, `Model: "flash"`
> - **Main Orchestrator:** Manages `contracts/openapi/tan-pms.v1.json`, cross-track OpenAPI sync, `npm run verify:docs`, and final verification gates.

## 1. Goal & Architecture

สร้างโค้ดฐานรากระดับ Production (**Phase 0 Enterprise Core Bootstrap + Core Domain & UI Slices**) ของโปรเจกต์ `tan-pms` โดยแยกเป็น 2 สายงานคู่ขนานที่ไม่ชนไฟล์กัน (Disjoint Workspaces):

1. **Backend (`backend/` — `.NET 10` 4-Layer Clean Architecture):**
   - `TanPms.Domain`: เอนทิตีหลักครบ 20 คำศัพท์ตาม `CONTEXT.md`, กฎ State Machine ทั้ง 7 ตาราง, Domain Exceptions พร้อม `errorCode` มาตรฐาน, สูตรคำนวณราคารายชั่วโมง (`HourlyPricingCalculator`: `GracePeriodMinutes`, `AutoCapToDailyRate`, `TurnaroundBufferMinutes`), สูตรมิเตอร์น้ำ-ไฟ (`UtilityMeterCalculator` พร้อม `MeterRollover`), สูตรภาษีไทยรายบรรทัด (`ThaiTaxCalculator`: `Exempt`, `VatIncluded`, `VatExcluded`, `WithholdingTax`), สมการกะแคชเชียร์ (`CashierShiftReconciler`), การปกปิดเลขบัตรประชาชน (`PiiMasker`: `1-xxxx-xxxxx-12-3`) และรูปแบบรหัสเอกสาร 9 หมวด (`DocumentNumberFormatter`: `RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`)
   - `TanPms.Application`: Interfaces & Services สำหรับ `ICurrentUserContext` (`AdminScope` / `ClientScope`), `IDocumentNumberService`, `IFileStorage`, `INotificationSender`, `IAuditLogger` และ DTOs แบบ Structured Projection (ห้ามส่งเฉพาะ FK UUID)
   - `TanPms.Infrastructure`: `TanPmsDbContext` (`EF Core 10`), `AuditableEntityInterceptor`, Soft-Delete Global Query Filter, In-Memory/PostgreSQL Sequence & Availability Services
   - `TanPms.WebApi`: RFC 9457 `ProblemDetails` Exception Handler, `AdminScope` & `ClientScope` Endpoint Filters, `/health/live`, `/health/ready`, `/api/v1/admin/...` และ `/api/v1/client/...` พร้อม OpenAPI Contract Export
   - ชุดทดสอบครบ 3 โปรเจกต์: `TanPms.ArchitectureTests` (`ArchUnitNET`), `TanPms.UnitTests` (`xUnit`), `TanPms.IntegrationTests` (`WebApplicationFactory`)

2. **Frontend (`frontend/` — `Next.js App Router` + `TypeScript Strict` + `Tailwind CSS` + `shadcn/ui`):**
   - ระบบโทเค็นและคอมโพเนนต์กลางตาม **Ollama Minimal Design System** (`design.md`): พื้นขาว `#ffffff`, สีหลัก `#000000`, ปุ่ม/ช่องกรอกทรงแคปซูล `9999px` (`rounded-full`), การ์ดขอบบาง `12px` (`1px solid #e5e5e5`), การ์ดสีเข้ม `.inverted-card` (`#171717`) สูงสุด 1 จุดต่อหน้า, `TerminalCard` พร้อมไฟจราจร 3 สี
   - Enterprise Hooks & Primitives: `FormTabs` (แสดงจุดแดง `#ff5f56` เมื่อแท็บมี Error), `useDeferredFileUpload` (อัปโหลดไฟล์เฉพาะตอนกด Submit ฟอร์ม), `problem-details.ts` แปล `errorCode`
   - ระบบ 2 ภาษา (`next-intl` / `messages/th.json` และ `messages/en.json` ที่มีความเท่ากันของคีย์ 100%)
   - หน้าจอหลักครบทั้ง Route Group `(auth)`, `(admin)` (`/admin` — Unified Room Rack, Quick Walk-in, Zero-Layout-Shift Bulk Meter Table, Cashier Shift Inverted Card) และ `(client)` (`/client` — Booking Hold TTL Countdown Inverted Card, Lease/Invoice/Utility overview, Deferred Slip Upload, WorkOrder & Parcel cards)
   - ชุดทดสอบ `Vitest` ยืนยัน Parity ของ `th.json`/`en.json`, พฤติกรรม `useDeferredFileUpload`, `FormTabs` Error Indicator และการแปล RFC 9457 `errorCode`
