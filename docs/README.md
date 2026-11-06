# `tan-pms` Documentation Map & Index

เอกสารนี้คือ **สารบัญกลาง (Master Documentation Map)** ของโปรเจกต์ **`tan-pms` (Enterprise Property Management System)**

> **กฎหลัก (One Authoritative Document per Concern):** ห้ามคัดลอกกฎซ้ำซ้อนข้ามไฟล์ หากต้องการอ้างอิงเรื่องใด ให้ลิงก์ไปยังเอกสารเจ้าของเรื่องตามตารางด้านล่างเสมอ

---

## 1. เอกสารธรรมาภิบาลระดับ Root (Root Authoritative Governance)

| เอกสาร | เจ้าของเรื่อง (Single Source of Truth) |
|---|---|
| [AGENTS.md](../AGENTS.md) | ธรรมนูญการพัฒนา กฎเหล็กของคนและ AI Agent, การแยก `(admin)` กับ `(client)` และ Tech Stack |
| [CONTEXT.md](../CONTEXT.md) | พจนานุกรมคำศัพท์โดเมน 20 คำหลัก (Ubiquitous Language), รหัสเอกสาร 9 หมวด และ State Machines |
| [design.md](../design.md) (`DESIGN.md`) | ระบบการออกแบบ **Ollama Minimal Design System** ร่วมกับ `Tailwind CSS` + `shadcn/ui`, `FormTabs`, `useDeferredFileUpload` |
| [PRODUCT.md](../PRODUCT.md) | เจตนารมณ์และตัวตนของผลิตภัณฑ์ (`impeccable` Product Authority) |
| [preview.html](../preview.html) | ต้นแบบหน้าจอ Interactive UI/UX Mockup ทั้งฝั่ง `(admin)` และ `(client)` ตามระบบ Ollama Design System |

---

## 2. แผนที่นำทางตามบทบาทผู้อ่าน (Reading Path by Role)

- **Product Owner / Business Analyst:**
  เริ่มจาก [CONTEXT.md](../CONTEXT.md) → [product-vision.md](00-overview/product-vision.md) → [scope-and-non-goals.md](00-overview/scope-and-non-goals.md) → [stay-and-lease-flows.md](01-business/stay-and-lease-flows.md) → [pricing-meter-and-tax-rules.md](01-business/pricing-meter-and-tax-rules.md)
- **Backend Engineer (`.NET 10` / `PostgreSQL`):**
  เริ่มจาก [AGENTS.md](../AGENTS.md) → [backend-architecture.md](02-architecture/backend-architecture.md) → [module-boundaries.md](02-architecture/module-boundaries.md) → [database-and-locking-standards.md](04-data/database-and-locking-standards.md) → [error-contract.md](03-contracts/error-contract.md) → [rbac-and-scopes.md](03-contracts/rbac-and-scopes.md)
- **Frontend Engineer (`Next.js` / `shadcn/ui`):**
  เริ่มจาก [AGENTS.md](../AGENTS.md) → [design.md](../design.md) → [frontend-architecture.md](02-architecture/frontend-architecture.md) → [api-conventions.md](03-contracts/api-conventions.md) → [error-contract.md](03-contracts/error-contract.md)
- **QA / Security / DevOps Engineer:**
  เริ่มจาก [development-ready-gate.md](05-engineering/development-ready-gate.md) → [testing-strategy.md](05-engineering/testing-strategy.md) → [pdpa-and-audit-redaction.md](04-data/pdpa-and-audit-redaction.md) → [environments-and-secrets.md](06-operations/environments-and-secrets.md) → [backup-restore-and-release.md](06-operations/backup-restore-and-release.md)

---

## 3. สารบัญเอกสารครบทั้ง 7 หมวด และ ADR (Complete Directory Index)

### `00-overview` — ภาพรวม ขอบเขต และแผนงาน (`PM-01` – `PM-10`)
- [00-overview/product-vision.md](00-overview/product-vision.md) — วิสัยทัศน์ ปัญหาธุรกิจที่แก้ไข และกลุ่มผู้ใช้งาน `admin` / `client`
- [00-overview/scope-and-non-goals.md](00-overview/scope-and-non-goals.md) — ขอบเขต 10 โมดูล, Non-Goals และ Anti-Goals
- [00-overview/implementation-roadmap.md](00-overview/implementation-roadmap.md) — ลำดับการพัฒนา `Phase 0` และ `PM-01` ถึง `PM-10` พร้อมเกณฑ์ตรวจสอบ

### `01-business` — กระบวนการธุรกิจ สูตรราคา มิเตอร์ และภาษี
- [01-business/stay-and-lease-flows.md](01-business/stay-and-lease-flows.md) — Flow การจอง (`Hold TTL`), การเข้าพัก `Hourly`/`Daily` (`Stay` + `Folio`), สัญญารายเดือน (`Lease`) และงานอาคาร
- [01-business/pricing-meter-and-tax-rules.md](01-business/pricing-meter-and-tax-rules.md) — สูตรคิดราคารายชั่วโมง, สูตรมิเตอร์น้ำ-ไฟ (`MeterRollover`), ภาษีไทยรายบรรทัด (`Exempt`, `VatIncluded`, `VatExcluded`, `WithholdingTax`) และกะแคชเชียร์

### `02-architecture` — สถาปัตยกรรมระบบและโครงสร้างโค้ด
- [02-architecture/system-context.md](02-architecture/system-context.md) — แผนภาพบริบทของระบบและการเชื่อมต่อภายนอก
- [02-architecture/module-boundaries.md](02-architecture/module-boundaries.md) — ความเป็นเจ้าของตารางและกฎการสื่อสารระหว่างโมดูล `PM-01`–`PM-10`
- [02-architecture/backend-architecture.md](02-architecture/backend-architecture.md) — โครงสร้าง `.NET 10` 4 ชั้น และการแบ่งหน้าที่ `EF Core 10` + `Dapper`
- [02-architecture/frontend-architecture.md](02-architecture/frontend-architecture.md) — โครงสร้าง `Next.js App Router` (`(auth)`, `(admin)`, `(client)`), `shadcn/ui` และ Enterprise Hooks

### `03-contracts` — สัญญา API, โครงสร้าง Error และสิทธิ์การใช้งาน
- [03-contracts/api-conventions.md](03-contracts/api-conventions.md) — มาตรฐาน URL (`/api/v1/admin`, `/api/v1/client`), Pagination และ Structured Projection
- [03-contracts/error-contract.md](03-contracts/error-contract.md) — มาตรฐาน RFC 9457 Problem Details และตารางรหัส `errorCode`
- [03-contracts/rbac-and-scopes.md](03-contracts/rbac-and-scopes.md) — การแยก `AdminScope` (`AllowedPropertyIds`) และ `ClientScope` (`CustomerId`)
- [03-contracts/permission-catalog.md](03-contracts/permission-catalog.md) — ทะเบียนรหัสสิทธิ์ครบทั้ง 10 โมดูลและการระบุสิทธิ์ความเสี่ยงสูง

### `04-data` — แบบจำลองข้อมูล การล็อกห้องว่าง และ PDPA
- [04-data/conceptual-data-model.md](04-data/conceptual-data-model.md) — แผนภาพ ER Diagram และความสัมพันธ์ของเอนทิตีหลัก
- [04-data/database-and-locking-standards.md](04-data/database-and-locking-standards.md) — มาตรฐาน PostgreSQL, `tstzrange` + `EXCLUDE USING gist`, และการรันเลขเอกสาร Atomic (`DocumentSequence`)
- [04-data/pdpa-and-audit-redaction.md](04-data/pdpa-and-audit-redaction.md) — การเข้ารหัสและ Masking เลขบัตรประชาชน (`1-xxxx-xxxxx-12-3`), Private File Storage และ `AuditEvent`

### `05-engineering` — มาตรฐานการทดสอบและเกณฑ์คุณภาพ
- [05-engineering/testing-strategy.md](05-engineering/testing-strategy.md) — พีระมิดการทดสอบ 4 ระดับ (`ArchUnitNET`, `xUnit`, `Testcontainers.PostgreSql`, `Playwright`)
- [05-engineering/development-ready-gate.md](05-engineering/development-ready-gate.md) — รายการตรวจสอบความพร้อม 20 ข้อตามมาตรฐาน `scaffold-enterprise-core`
- [05-engineering/definition-of-done.md](05-engineering/definition-of-done.md) — เกณฑ์ตรวจรับงานราย Vertical Slice

### `06-operations` — สภาพแวดล้อม การเฝ้าระวัง และการสำรองข้อมูล
- [06-operations/environments-and-secrets.md](06-operations/environments-and-secrets.md) — การแยก `Development`/`Staging`/`Production` และการจัดการ Secrets
- [06-operations/observability-and-health.md](06-operations/observability-and-health.md) — Structured Logging, Health Checks (`/health/live`, `/health/ready`) และ Metrics
- [06-operations/backup-restore-and-release.md](06-operations/backup-restore-and-release.md) — นโยบาย RPO/RTO, การซ้อมกู้คืนข้อมูล และ Release Readiness Checklist

### `adr` — บันทึกการตัดสินใจทางสถาปัตยกรรม (Architecture Decision Records)
- [adr/0001-clean-architecture-and-stack.md](adr/0001-clean-architecture-and-stack.md) — การเลือกใช้ `.NET 10` Clean Architecture, `EF Core 10` + `Dapper` และ `Next.js`
- [adr/0002-hybrid-availability-and-ttl-hold.md](adr/0002-hybrid-availability-and-ttl-hold.md) — กลไกป้องกันการจองซ้อนด้วย `tstzrange` + โควตา `UnitType` + `Hold TTL 15 นาที`
- [adr/0003-ollama-design-system-and-shadcn.md](adr/0003-ollama-design-system-and-shadcn.md) — การใช้ระบบการออกแบบ **Ollama Minimal Design System** ร่วมกับ `Tailwind CSS` และ `shadcn/ui`

### `superpowers` — เอกสารสเปกและแผนการดำเนินงาน
- [superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md](superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md) — เอกสารออกแบบระบบฉบับเต็ม
- [superpowers/plans/2026-11-06-tan-pms-documentation-and-governance-foundation.md](superpowers/plans/2026-11-06-tan-pms-documentation-and-governance-foundation.md) — แผนการสร้างฐานรากเอกสารและธรรมาภิบาล
