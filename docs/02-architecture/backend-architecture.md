# Backend Architecture (`.NET 10` Clean Architecture) — `tan-pms`

เอกสารนี้กำหนดโครงสร้างและกฎทางวิศวกรรมของฝั่ง Backend (`backend/`) สำหรับ **`tan-pms`**

> อ้างอิงธรรมนูญโปรเจกต์จาก [AGENTS.md](../../AGENTS.md) และการตัดสินใจสถาปัตยกรรมจาก [0001-clean-architecture-and-stack.md](../adr/0001-clean-architecture-and-stack.md)

---

## 1. โครงสร้างโปรเจกต์ 4 ชั้น (4-Layer Clean Architecture)

```text
backend/
├── Directory.Build.props            # Nullable=enable, ImplicitUsings=enable, TreatWarningsAsErrors=true
├── Directory.Packages.props         # Central Package Management (CPM)
├── TanPms.slnx
├── src/
│   ├── TanPms.Domain/               # ชั้นในสุด: Entities, Value Objects, Enums, Domain Exceptions
│   ├── TanPms.Application/          # Use Cases, Commands/Queries, DTOs, FluentValidation, Ports/Interfaces
│   ├── TanPms.Infrastructure/       # EF Core 10, Dapper, PostgreSQL, QuestPDF, FileStorage, Background Workers
│   └── TanPms.WebApi/               # Endpoints (/api/v1/admin & /api/v1/client), Auth Filters, ProblemDetails
└── tests/
    ├── TanPms.ArchitectureTests/    # ArchUnitNET ตรวจสอบทิศทางการอ้างอิงชั้นโปรเจกต์
    ├── TanPms.UnitTests/            # ทดสอบสูตรราคา/มิเตอร์/ภาษี และ State Machine ใน Domain/Application
    └── TanPms.IntegrationTests/     # ทดสอบกับ PostgreSQL จริงผ่าน Testcontainers
```

### กฎทิศทางการอ้างอิง (Dependency Rule)
- `TanPms.Domain` **ห้าม** อ้างอิงโปรเจกต์อื่น และห้ามอ้างอิง `Microsoft.EntityFrameworkCore` หรือ `Dapper`
- `TanPms.Application` อ้างอิงได้เฉพาะ `TanPms.Domain`
- `TanPms.Infrastructure` อ้างอิง `TanPms.Application` และ `TanPms.Domain`
- `TanPms.WebApi` เป็น Composition Root สำหรับ Dependency Injection และ HTTP Pipeline

---

## 2. การแบ่งหน้าที่ระหว่าง `EF Core 10` และ `Dapper` (CQRS Data Access)

1. **Commands / Writes (`EF Core 10`):**
   - ใช้ `TanPmsDbContext` สำหรับการสร้าง แก้ไข เปลี่ยนสถานะ และรัน Migrations ทั้งหมด
   - มี `AuditableEntityInterceptor` เติม `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy` และแปลงการลบทั่วไปเป็น Soft Delete (`IsDeleted = true`, `DeletedAt`, `DeletedBy`) อัตโนมัติ
   - มี Global Query Filter กรอง `IsDeleted == false`
2. **Complex Reads (`Dapper`):**
   - ใช้ `Dapper` ร่วมกับ SQL ที่เขียนอย่างชัดเจนสำหรับหน้าจอที่ต้องการความเร็วสูงและการรวมข้อมูลหลายตาราง เช่น:
     - `UnifiedRoomRackQuery` (ดึงสถานะ `Unit` + `Stay` รายชั่วโมง/รายวัน + `Lease` รายเดือน + `Reservation` ในหน้าจอเดียว)
     - `BulkMeterSheetQuery` (ดึงรายการห้องพร้อมเลขมิเตอร์เดือนก่อนหน้ายกตึก)
     - `ExecutiveAnalyticsQuery` (คำนวณ Occupancy Rate, RevPAR และ Aging Report)
   - ทุก Read Query ต้องส่งข้อมูลอ้างอิงแบบ Structured Projection (เช่น `unitNumber`, `buildingName`, `customerFullName`) เพื่อไม่ให้ Frontend ต้องไป `.find()` เอง

---

## 3. การบังคับใช้ `AdminScope` และ `ClientScope`

- **กลุ่ม `/api/v1/admin/...`:**
  - บังคับใช้ `AdminScopeEndpointFilter` ที่ตรวจสอบว่า `PropertyId` ใน Route/Query/Body อยู่ใน `ICurrentUserContext.AllowedPropertyIds` และผู้ใช้มี Permission Key ที่ตรงกับ Endpoint นั้น
- **กลุ่ม `/api/v1/client/...`:**
  - บังคับใช้ `ClientScopeEndpointFilter` ที่ดึง `CustomerId` จาก Token ของผู้ล็อกอินโดยตรง ห้ามรับ `CustomerId` จาก Query/Body ของฝั่ง `client` มาใช้ค้นหาข้อมูลข้ามคนเด็ดขาด
