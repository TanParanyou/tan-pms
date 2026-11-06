# tan-pms Documentation, Governance & Enterprise Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างชุดเอกสารธรรมาภิบาล (Governance), พจนานุกรมคำศัพท์ธุรกิจ (`CONTEXT.md`), มาตรฐานการออกแบบ (`design.md` ระบบ Ollama Design System), โครงสร้างเอกสารสถาปัตยกรรมและธุรกิจครบทั้ง 7 หมวด (`docs/00-overview` ถึง `06-operations` + `docs/adr/`) พร้อมสคริปต์ตรวจสอบความถูกต้องของเอกสารและลิงก์อัตโนมัติ (`scripts/verify-docs.mjs`) สำหรับโปรเจกต์ `tan-pms`

**Architecture:** ยึดหลัก **One Authoritative Document per Concern** จาก `tan-erp` และเสาหลักทั้ง 8 ของ `scaffold-enterprise-core` โดยแยกกฎการพัฒนาไว้ที่ `AGENTS.md`, คำศัพท์และ State Machine ไว้ที่ `CONTEXT.md`, ระบบ Design Tokens (Ollama Minimal Design System + `shadcn/ui`) ไว้ที่ `design.md` และ `DESIGN.md`, และเชื่อมโยงแผนที่เอกสารทั้งหมดผ่าน `docs/README.md` โดยมีสคริปต์ Node.js ตรวจสอบว่าทุกไฟล์ที่อ้างอิงมีอยู่จริง ไม่มี Broken Links และมีคำศัพท์/รหัสเอกสารครบตามสเปก

**Tech Stack:** Markdown (GitHub Flavored Markdown), Node.js (`scripts/verify-docs.mjs` สำหรับตรวจโครงสร้างเอกสาร, Internal Markdown Links, รหัสเอกสาร 9 หมวด และสถานะ State Machine), JSON/YAML Frontmatter (`DESIGN.md`)

**Spec:** `docs/superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md`

## Global Constraints

- ใช้คำว่า **`admin`** แทนฝั่งพนักงาน/ผู้บริหาร และใช้คำว่า **`client`** แทนฝั่งลูกค้า/ผู้เช่า ในทุกเอกสาร โครงสร้าง Route (`/admin/...`, `/client/...`) และชื่อ Policy/Scope (`AdminScope`, `ClientScope`)
- ใช้คำศัพท์มาตรฐานจากสเปกเท่านั้น: `Property` (ห้ามใช้ `Branch`/`Hotel`), `Building`, `Floor`, `UnitType` (ห้ามใช้ `RoomType`), `Unit` (ห้ามใช้ `Room`), `StayMode` (`Hourly`, `Daily`, `Monthly`), `Customer`, `Occupant`, `Reservation` (ห้ามใช้ `Booking`), `Stay`, `Folio`, `Lease` (ห้ามใช้ `Contract`), `MeterReading`, `Invoice`, `Receipt`, `CashierShift`, `DepositLedger`, `HousekeepingTask`, `WorkOrder`, `Parcel`
- รหัสเอกสารมาตรฐาน 9 หมวด รูปแบบ `{PROP}-{DOC}-{YY}{MM}-{SEQ:4}` ได้แก่: `RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`
- ระบบดีไซน์ยึดตาม **Ollama Minimal Design System** (`DESIGN.md`): พื้นขาว `#ffffff`, สีหลัก `#000000` (กด `#090909`), พื้นผิวรอง `#fafafa`, เส้นขอบ `#e5e5e5` / `#d4d4d4`, พื้นผิวเข้ม `#171717` เพียง 1 จุดต่อหน้า, มุมโค้ง `9999px` (`rounded-full`) สำหรับปุ่ม/ช่องกรอก/แท็กคำสั่งทั้งหมด และ `12px` (`rounded-lg`) สำหรับการ์ด ร่วมกับโครงสร้าง `Tailwind CSS` + `shadcn/ui`
- Tech Stack เป้าหมายของระบบคือ `.NET 10 (Clean Architecture 4 ชั้น: Domain, Application, Infrastructure, WebApi)` + `Next.js (App Router, Strict TypeScript)` + `PostgreSQL (EF Core 10 + Dapper + tstzrange)`
- ห้ามคัดลอกคำสั่งซ้ำซ้อนข้ามเอกสาร ให้ใช้การลิงก์ไปยังเอกสารเจ้าของเรื่อง (One Authoritative Document per Concern)

## Review Focus

- ลิงก์ภายในเอกสาร Markdown (`docs/README.md`, `AGENTS.md`, `CONTEXT.md`, `design.md`) ชี้ไปยังไฟล์ที่ไม่มีอยู่จริงหรือสะกด Path ผิด — ต้องมีสคริปต์ตรวจทุก Relative Markdown Link แล้วล้มทันทีหากพบไฟล์หาย
- การหลุดใช้คำต้องห้าม (`Staff`, `Portal`, `RoomType`, `Booking`, `Contract`) ในตารางคำศัพท์หรือชื่อ Route — สคริปต์ตรวจต้องยืนยันว่า `CONTEXT.md` นิยามครบทั้ง 18 คำหลักและระบุคำต้องห้ามครบถ้วน
- รหัสเอกสาร 9 หมวด (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`) หรือ Slice ทั้ง 10 โมดูล (`PM-01` ถึง `PM-10`) ตกหล่นใน Roadmap และ Contract Docs — สคริปต์ตรวจต้องยืนยันความครบถ้วนของรหัสทั้งหมด
- กฎ UI ใน `AGENTS.md` และ `design.md` ขัดแย้งกันเองระหว่างธีมเก่า (`0px Navy`) กับธีมใหม่ที่อนุมัติแล้ว (**Ollama Minimal Design System**: `#000000` บน `#ffffff`, `9999px` pills, `12px` cards, `#171717` single inverted card) — ต้องระบุกฎของ Ollama Design System + `shadcn/ui` ให้ตรงกันทั้งสองไฟล์
- กฎความปลอดภัยเฉพาะธุรกิจที่พัก (Dual-Scope `AdminScope`/`ClientScope`, PDPA Masking เลขบัตรประชาชน/พาสปอร์ต, Private File Access, Cashier Shift Integrity) ไม่ปรากฏในเอกสาร Architecture และ Data/Security Contracts — ต้องมีเอกสารเฉพาะรองรับและตรวจพบได้

---

### Task 1: Governance Verification Harness & Root Governance Files (`AGENTS.md`, `CONTEXT.md`, `design.md`)

**Files:**
- Create: `scripts/verify-docs.mjs`
- Create: `AGENTS.md`
- Create: `CONTEXT.md`
- Create: `design.md`
- Modify: `package.json` (สร้างไฟล์ `package.json` ระดับ Root สำหรับรัน `npm run verify:docs`)

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md`, `DESIGN.md`, `PRODUCT.md`
- Produces:
  - `npm run verify:docs` (`node scripts/verify-docs.mjs`) ที่ตรวจสอบการมีอยู่ของไฟล์บังคับ, ความถูกต้องของ Relative Links ทั้งหมดใน `.md`, คำศัพท์หลัก 18 คำใน `CONTEXT.md`, รหัสเอกสาร 9 หมวด (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`), โมดูล `PM-01`–`PM-10` และโทเค็นหลักของ Ollama Design System ใน `design.md`

- [ ] **Step 1: สร้าง `package.json` และสคริปต์ตรวจสอบ `scripts/verify-docs.mjs` เพื่อเป็น Failing Test Gate**

สร้าง `package.json` ที่มี `"scripts": { "verify:docs": "node scripts/verify-docs.mjs" }` และเขียน `scripts/verify-docs.mjs` ให้ตรวจ:
1. ไฟล์ระดับ Root ต้องมีครบ: `AGENTS.md`, `CONTEXT.md`, `design.md`, `DESIGN.md`, `PRODUCT.md`, `docs/README.md`
2. `CONTEXT.md` ต้องมีหัวข้อคำศัพท์ครบทั้ง 18 คำ (`Property`, `Building`, `Floor`, `UnitType`, `Unit`, `StayMode`, `Customer`, `Occupant`, `Reservation`, `Stay`, `Folio`, `Lease`, `MeterReading`, `Invoice`, `Receipt`, `CashierShift`, `DepositLedger`, `HousekeepingTask`, `WorkOrder`, `Parcel`) และรหัสเอกสารครบ 9 รหัส (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`)
3. `AGENTS.md` และ `design.md` ต้องระบุกฎ Ollama Design System (`#000000`, `#ffffff`, `#171717`, `9999px`, `12px`, `SF Pro Rounded`), การแยก `(admin)` กับ `(client)` และไม่มีสี `#0B3056` ค้างอยู่
4. ทุก Relative Markdown Link `[...](path)` ในไฟล์ `.md` ที่ตรวจต้องชี้ไปยังไฟล์ที่มีอยู่จริงบนดิสก์

- [ ] **Step 2: รัน `node scripts/verify-docs.mjs` เพื่อยืนยันว่าล้ม (FAIL) เนื่องจากยังไม่มีไฟล์**

Run: `node scripts/verify-docs.mjs`
Expected: FAIL พร้อมรายงานว่าไม่พบ `AGENTS.md`, `CONTEXT.md`, `design.md`, `docs/README.md`

- [ ] **Step 3: สร้าง `CONTEXT.md`, `design.md` และ `AGENTS.md` ตามสเปก**

- `CONTEXT.md`: นิยาม Ubiquitous Language ครบทุกคำตามตารางใน Spec หมวด 4.1 (ระบุคำที่ห้ามใช้แทนชัดเจน), รหัสเอกสาร 9 หมวดตามหมวด 4.2, ตาราง State Machine ทั้ง 7 เอนทิตีตามหมวด 4.3 และกฎธุรกิจสำคัญ (Zero Double-Booking, TTL Hold, Separate Tax Lines, Deposit Ledger Isolation, Dirty Room Check-in Block)
- `design.md`: ถอดกฎ UI/UX สำหรับ `tan-pms` ที่ผสาน **Ollama Minimal Design System (`DESIGN.md`)** เข้ากับโครงสร้าง **`Tailwind CSS` + `shadcn/ui`** และมาตรฐานฟอร์ม/ตารางระดับ Enterprise (Pill geometry `9999px` สำหรับปุ่ม/Input/Select, การ์ดขอบบาง `12px` `#e5e5e5`, พื้นผิวสีเข้ม `#171717` เพียง 1 จุดต่อหน้า, Terminal Card พร้อมจุดไฟจราจร 3 สี, `FormTabs` พร้อมจุดแดงแจ้งเตือน Error, `useDeferredFileUpload`, Zero-Layout-Shift สำหรับตารางคำนวณมิเตอร์สด, Top-Right Field Actions และ Icon-First Adjacent Buttons)
- `AGENTS.md`: กฎเหล็กการทำงานของคนและ AI Agent สำหรับ `tan-pms` อ้างอิงโครงสร้างจาก `tan-erp/AGENTS.md` แต่ปรับเป็นโดเมน `tan-pms` (`.NET 10` + `Next.js` + `PostgreSQL`, แยก `(admin)` / `(client)`, ใช้ Ollama Design System ตาม `design.md` และ `DESIGN.md`, กฎ Strict TypeScript/C#, i18n `th`/`en`, No FE Find Logic, RFC 9457 Problem Details และ Verification Gates)

- [ ] **Step 4: รัน `node scripts/verify-docs.mjs --root-only` เพื่อยืนยันว่าไฟล์ระดับ Root ผ่านครบ**

Run: `node scripts/verify-docs.mjs --root-only`
Expected: PASS สำหรับการตรวจ `AGENTS.md`, `CONTEXT.md`, `design.md`, `DESIGN.md`, `PRODUCT.md`

---

### Task 2: Overview, Business Flows & Architecture Documentation (`docs/00-overview/`, `docs/01-business/`, `docs/02-architecture/`, `docs/adr/`)

**Files:**
- Create: `docs/00-overview/product-vision.md`
- Create: `docs/00-overview/scope-and-non-goals.md`
- Create: `docs/00-overview/implementation-roadmap.md`
- Create: `docs/01-business/stay-and-lease-flows.md`
- Create: `docs/01-business/pricing-meter-and-tax-rules.md`
- Create: `docs/02-architecture/system-context.md`
- Create: `docs/02-architecture/module-boundaries.md`
- Create: `docs/02-architecture/backend-architecture.md`
- Create: `docs/02-architecture/frontend-architecture.md`
- Create: `docs/adr/0001-clean-architecture-and-stack.md`
- Create: `docs/adr/0002-hybrid-availability-and-ttl-hold.md`
- Create: `docs/adr/0003-ollama-design-system-and-shadcn.md`
- Modify: `scripts/verify-docs.mjs`

**Interfaces:**
- Consumes: `CONTEXT.md`, `design.md`, `docs/superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md`
- Produces: เอกสารหมวด `00-overview`, `01-business`, `02-architecture` และ `adr` ที่ครบถ้วนและอ้างอิงได้จาก `docs/README.md`

- [ ] **Step 1: เพิ่มกฎตรวจเอกสารหมวด `00-overview`, `01-business`, `02-architecture`, `adr` ลงใน `scripts/verify-docs.mjs`**

เพิ่มรายการไฟล์บังคับทั้ง 12 ไฟล์และการตรวจว่า `docs/00-overview/implementation-roadmap.md` มีครบทั้ง `PM-01` ถึง `PM-10` พร้อมเกณฑ์ผ่านของแต่ละ Slice

- [ ] **Step 2: รัน `node scripts/verify-docs.mjs` เพื่อยืนยันว่าล้ม (FAIL) เพราะยังไม่มีไฟล์หมวด 00–02 และ ADR**

Run: `node scripts/verify-docs.mjs`
Expected: FAIL พร้อมระบุชื่อไฟล์ใน `docs/00-overview/`, `docs/01-business/`, `docs/02-architecture/`, `docs/adr/` ที่ยังขาด

- [ ] **Step 3: สร้างเอกสารใน `docs/00-overview/`, `docs/01-business/`, `docs/02-architecture/` และ `docs/adr/`**

- `docs/00-overview/product-vision.md`: เป้าหมายธุรกิจของ `tan-pms`, ผู้ใช้งานฝั่ง `admin` และ `client`, จุดเด่นการรวม `Hourly` + `Daily` + `Monthly`
- `docs/00-overview/scope-and-non-goals.md`: ขอบเขต 10 โมดูล, Non-goals (Single-Org Multi-Property, ไม่ทำ Full GL, Web Responsive ก่อนแอปแยก) และ Anti-goals
- `docs/00-overview/implementation-roadmap.md`: ลำดับการพัฒนาตั้งแต่ Phase 0 (Enterprise Core Bootstrapตาม `scaffold-enterprise-core`) ต่อด้วย Vertical Slices `PM-01` ถึง `PM-10` พร้อมตาราง Dependencies และ Verification Evidence
- `docs/01-business/stay-and-lease-flows.md`: Flow การจอง (`UnitType` Quota vs Specific `Unit`, `Hold TTL 15m`), Flow รายชั่วโมง/รายวัน (`Stay` + `Folio` + `TurnaroundBufferMinutes`), Flow สัญญารายเดือน (`Lease` + Move-in/Transfer/Renewal/Move-out) และ Flow แม่บ้าน/แจ้งซ่อม/รับพัสดุ
- `docs/01-business/pricing-meter-and-tax-rules.md`: สูตรคำนวณราคารายชั่วโมง (แพ็กเกจเริ่มต้น + ชั่วโมงถัดไป + `GracePeriodMinutes` + `AutoCapToDailyRate`), สูตรคิดค่าน้ำ-ไฟ (ตามหน่วยจริง/ขั้นต่ำ/เหมาจ่าย + `MeterRollover`), โครงสร้างภาษีไทยรายบรรทัด (`Exempt`, `VatIncluded`, `VatExcluded`, `WithholdingTax`) และกฎกะแคชเชียร์/`DepositLedger`
- `docs/02-architecture/`: แผนภาพและข้อกำหนด `system-context.md`, `module-boundaries.md`, `backend-architecture.md` (`.NET 10` 4 ชั้น, EF Core Writes + Dapper Reads), `frontend-architecture.md` (`Next.js App Router`, Route Groups `(auth)`, `(admin)`, `(client)`, `shadcn/ui` + Ollama Tokens)
- `docs/adr/0001..0003`: บันทึกการตัดสินใจตามแม่แบบ `scaffold-enterprise-core/templates/ADR.md.tpl`

- [ ] **Step 4: รัน `node scripts/verify-docs.mjs` เพื่อตรวจว่าหมวด 00–02 และ ADR ผ่านครบ**

Run: `node scripts/verify-docs.mjs`
Expected: หมวด `00-overview`, `01-business`, `02-architecture`, `adr` ผ่านทั้งหมด

---

### Task 3: Contracts, Data, Engineering, Operations & Master Documentation Map (`docs/03-contracts/` – `docs/06-operations/` & `docs/README.md`)

**Files:**
- Create: `docs/03-contracts/api-conventions.md`
- Create: `docs/03-contracts/error-contract.md`
- Create: `docs/03-contracts/rbac-and-scopes.md`
- Create: `docs/03-contracts/permission-catalog.md`
- Create: `docs/04-data/conceptual-data-model.md`
- Create: `docs/04-data/database-and-locking-standards.md`
- Create: `docs/04-data/pdpa-and-audit-redaction.md`
- Create: `docs/05-engineering/testing-strategy.md`
- Create: `docs/05-engineering/development-ready-gate.md`
- Create: `docs/05-engineering/definition-of-done.md`
- Create: `docs/06-operations/environments-and-secrets.md`
- Create: `docs/06-operations/observability-and-health.md`
- Create: `docs/06-operations/backup-restore-and-release.md`
- Create: `docs/README.md`
- Create: `README.md`
- Modify: `scripts/verify-docs.mjs`

**Interfaces:**
- Consumes: เอกสารทั้งหมดจาก Task 1 และ Task 2, มาตรฐาน [04-security-baseline.md](file:///Users/syaco/Documents/development/tan-skills/skills/scaffold-enterprise-core/references/04-security-baseline.md), [05-ops-baseline.md](file:///Users/syaco/Documents/development/tan-skills/skills/scaffold-enterprise-core/references/05-ops-baseline.md), [07-verification.md](file:///Users/syaco/Documents/development/tan-skills/skills/scaffold-enterprise-core/references/07-verification.md)
- Produces: เอกสารครบทั้งระบบพร้อม `docs/README.md` (สารบัญแยกตามบทบาทผู้อ่านเหมือน `tan-erp/docs/README.md`) และ `README.md` ระดับ Root ที่ผ่าน `npm run verify:docs` 100%

- [ ] **Step 1: เพิ่มกฎตรวจเอกสารหมวด `03-contracts` ถึง `06-operations`, `docs/README.md` และ `README.md` ลงใน `scripts/verify-docs.mjs`**

ตั้งให้ `scripts/verify-docs.mjs` ตรวจครบทุกไฟล์ในหมวด 03–06, ตรวจว่า `docs/README.md` มีลิงก์เชื่อมไปยังเอกสารทุกฉบับโดยไม่มีไฟล์กำพร้า (Orphan Docs) และไม่มี Broken Links

- [ ] **Step 2: รัน `node scripts/verify-docs.mjs` เพื่อยืนยันว่าล้ม (FAIL) เพราะยังขาดไฟล์หมวด 03–06 และ `docs/README.md`**

Run: `node scripts/verify-docs.mjs`
Expected: FAIL พร้อมแสดงรายการไฟล์หมวด 03–06 ที่ยังไม่ได้สร้าง

- [ ] **Step 3: สร้างเอกสารหมวด `03-contracts` ถึง `06-operations`, `docs/README.md` และ `README.md`**

- `docs/03-contracts/`:
  - `api-conventions.md`: Prefix `/api/v1/admin/...` และ `/api/v1/client/...`, Pagination, Filtering, Structured Projection (ห้ามส่งเฉพาะ FK UUID ไปให้ FE `.find()` เอง), OpenAPI Single Source of Truth
  - `error-contract.md`: มาตรฐาน RFC 9457 Problem Details พร้อมรหัส `errorCode` มาตรฐาน (เช่น `unit.not_clean`, `reservation.slot_overlap`, `reservation.hold_expired`, `shift.not_open`, `meter.rollover_unconfirmed`)
  - `rbac-and-scopes.md` & `permission-catalog.md`: การแยก `AdminScope` (`AllowedPropertyIds` + Permission Keys) และ `ClientScope` (`CustomerId` Isolation) พร้อมตาราง Permission ครบทั้ง 10 Slice (`PM-01`–`PM-10`)
- `docs/04-data/`:
  - `conceptual-data-model.md`: ER Diagram (Mermaid) และความสัมพันธ์ของเอนทิตีหลักทั้งหมด
  - `database-and-locking-standards.md`: มาตรฐาน `PostgreSQL tstzrange` + `EXCLUDE USING gist`, Row/Advisory Lock สำหรับ `UnitType` Quota, และ Atomic Document Numbering (`INSERT ... ON CONFLICT DO UPDATE RETURNING`)
  - `pdpa-and-audit-redaction.md`: การเข้ารหัสและ Masking เลขบัตรประชาชน/พาสปอร์ต (`1-xxxx-xxxxx-12-3`), กฎ Private File Storage และตาราง `AuditEvent`
- `docs/05-engineering/`:
  - `testing-strategy.md`, `development-ready-gate.md` (อ้างอิง 20 ข้อจาก `scaffold-enterprise-core/references/07-verification.md`), `definition-of-done.md`
- `docs/06-operations/`:
  - `environments-and-secrets.md`, `observability-and-health.md`, `backup-restore-and-release.md` (อ้างอิง `04-security-baseline.md` และ `05-ops-baseline.md`)
- `docs/README.md` & `README.md`: แผนที่นำทางเอกสารแยกตามผู้อ่านและคำแนะนำเริ่มต้นโปรเจกต์

- [ ] **Step 4: รัน `npm run verify:docs` เพื่อยืนยันว่าผ่านทุกข้อ 100%**

Run: `npm run verify:docs`
Expected: PASS (ตรวจผ่านครบทุกไฟล์, ทุกคำศัพท์, ทุกรหัสเอกสาร, ทุกโมดูล `PM-01`–`PM-10` และไม่มี Broken Links)
