# tan-pms Agent Guide (`AGENTS.md`)

## Start here

> ⚠️ **กฎเหล็กก่อนเริ่มงาน (Mandatory Pre-work & Development Rules):**
> - **ก่อนทำให้อ่าน `AGENTS.md` และ `design.md` เสมอ:** เพื่อเข้าใจกฎระเบียบของระบบ ข้อจำกัดทางสถาปัตยกรรม และมาตรฐาน Design System **Ollama Minimal Design System** ร่วมกับ `Tailwind CSS` และ `shadcn/ui`
> - **ไม่ทำเกินที่ขอ & ไม่แก้ส่วนที่ไม่ได้สั่ง (Strict Scope & Minimal Blast Radius):** ทำเฉพาะสิ่งที่ได้รับมอบหมายอย่างเคร่งครัด แตะเฉพาะไฟล์ที่เกี่ยวข้องโดยตรง ห้าม refactor, จัดระเบียบ หรือแก้โค้ด/ดีไซน์ในจุดที่ไม่ได้รับคำสั่งเด็ดขาด
> - **ไม่ชัด ให้ถามก่อน ห้ามเดา (Clarify Before Acting):** หากความต้องการไม่ชัดเจน มีความกำกวม หรือมีทางเลือกที่ต้องตัดสินใจ ให้สอบถามผู้ใช้ทันที ห้ามคาดเดาหรืออนุมานเอาเอง
> - **ตรวจก่อน แล้วบอกว่าตรวจอะไร (Verify & Report Evidence):** ก่อนส่งงานหรือยืนยันความเรียบร้อย ต้องรันคำสั่งตรวจสอบ (เช่น `npm run verify:docs`, type check, test, build หรือ linter) และระบุผลการตรวจสอบชัดเจนเสมอว่าตรวจอะไรไปบ้างและผลลัพธ์เป็นอย่างไร
> - **ห้ามใช้ type `any`, `as any` หรือ `@ts-ignore` เด็ดขาด:** ให้ใช้ strict types, interfaces หรือ `unknown` แล้ว narrow อย่างรัดกุม
> - **ห้าม Hardcode ข้อความและค่าคงที่:** ข้อความที่แสดงบนหน้าจอทั้งหมดต้องดึงผ่านระบบแปลภาษา (`i18n`) เสมอ
> - **แปลภาษาให้ครบทั้งสองภาษา (`th` และ `en`):** ภาษาไทยเป็นค่าเริ่มต้น และต้องมีคู่เทียบภาษาอังกฤษเสมอใน `messages/` (`th.json` และ `en.json`) ห้ามตกหล่น
> - **Reuse First & Global Reuse Proposal:** ส่วนไหนที่มี components, hooks, หรือ functions กลางอยู่แล้วให้นำมาใช้เสมอ หากไม่มี ให้เสนอแนะในการทำ Global Reuse แก่ผู้ใช้ก่อนเริ่มลงมือสร้าง
> - **Tailwind-first & `shadcn/ui` Frontend:** งาน UI ใน `frontend/` ต้องใช้ `Tailwind CSS` utilities, คอมโพเนนต์ `shadcn/ui` กลางใน `src/components/ui/` และ semantic tokens ตาม `design.md` ก่อนแก้ Styling เสมอ

อ่าน [CONTEXT.md](./CONTEXT.md) สำหรับคำศัพท์ธุรกิจที่เป็นทางการ (20 คำหลัก, รหัสเอกสาร 9 หมวด และ 7 State Machines) และอ่าน [docs/README.md](./docs/README.md) สำหรับแผนที่เอกสารทั้งหมดก่อนเริ่มแก้ไขโค้ดใน Repository นี้

## Current phase

This repository is in **Foundation & Application Implementation (`Phase 0` & `PM-01`–`PM-10`)**. ก่อนประเมินสถานะหรือเลือกงานถัดไป ให้อ่าน [Implementation Roadmap](./docs/00-overview/implementation-roadmap.md) ซึ่งเป็นแหล่งหลักของสถานะ implementation และชี้ไปยังหลักฐานตรวจสอบแต่ละ slice. อ่าน [Phase 0 & Core Foundation Plan](./docs/superpowers/plans/2026-11-06-tan-pms-phase0-and-pm01-foundation.md) และ [Enterprise Foundation Design Spec](./docs/superpowers/specs/2026-11-06-tan-pms-enterprise-foundation-and-features-design.md) เมื่อต้องวางแผนปิดช่องว่างหรือขยายโมดูล

การมีโค้ดหรือผลทดสอบบางชุดยังไม่เท่ากับผ่าน UAT หรือพร้อม Production ต้องตรวจสอบตาม [Development-Ready Gate](./docs/05-engineering/development-ready-gate.md) และ [Definition of Done](./docs/05-engineering/definition-of-done.md) เสมอ

## Product boundaries

- Call the product **`tan-pms`** (Enterprise Property Management System) สำหรับองค์กรเดียวที่มีหลายสาขาและหลายอาคาร (**Single-Organization, Multi-Property/Multi-Building**) รองรับการเข้าพักทั้ง 3 โหมด (`StayMode`: `Hourly`, `Daily`, `Monthly`)
- แยกกลุ่มผู้ใช้งานและขอบเขตสิทธิ์เป็น 2 ฝั่งอย่างเคร่งครัด:
  - **`admin` (`/admin/...`, Route Group `(admin)`, `/api/v1/admin/...`, `AdminScope`):** สำหรับพนักงานต้อนรับ, แคชเชียร์, แม่บ้าน, ช่างซ่อมบำรุง, ฝ่ายบัญชี และผู้บริหาร (ตรวจสอบ `AllowedPropertyIds` + Permission Key) — **ห้ามใช้คำว่า `staff` หรือ `backoffice`**
  - **`client` (`/client/...`, Route Group `(client)`, `/api/v1/client/...`, `ClientScope`):** สำหรับลูกค้าจองห้องพักออนไลน์และผู้เช่ารายเดือน (ตรวจสอบ `CustomerId == CurrentUser.CustomerId`) — **ห้ามใช้คำว่า `portal` หรือ `member`**
- Thai is the default language (`th`). Pair important English technical terms with a short Thai explanation.
- Keep one authoritative document per concern. Link to it instead of duplicating rules:
  - คำศัพท์โดเมน, รหัสเอกสาร 9 หมวด และ State Machine: [CONTEXT.md](./CONTEXT.md)
  - ระบบ Design Tokens (**Ollama Minimal Design System**) และกฎ UI/UX: [design.md](./design.md)
  - เจตนารมณ์และตัวตนของผลิตภัณฑ์: [PRODUCT.md](./PRODUCT.md)
  - สารบัญและแผนที่เอกสารสถาปัตยกรรมทั้งหมด: [docs/README.md](./docs/README.md)
- Record durable trade-off decisions in `docs/adr/` and business vocabulary only in [CONTEXT.md](./CONTEXT.md).

---

## 1. Language & Communication (ภาษาและการสื่อสาร)

- **ตอบกลับผู้ใช้เป็นภาษาไทยเสมอ** ทุกครั้งโดยไม่มีข้อยกเว้น
- **ห้าม Hardcode ข้อความบน UI:** ข้อความทั้งหมดต้องดึงผ่านระบบ `i18n` จาก `messages/th.json` และ `messages/en.json`
- **Zero Thai Characters in `.tsx` & Typed Constants Separation:** ห้ามมีตัวอักษรภาษาไทย (`[\u0E00-\u0E7F]`) หรือข้อความ UI Hardcode ในไฟล์ `.tsx` (`src/app/**`, `src/features/**/components/**`, `src/components/**`) เด็ดขาด และข้อมูลตั้งต้น/ตัวเลือกคงที่ต้องแยกไว้ใน `src/features/<feature>/constants.ts` เสมอ
- **แปลภาษาให้ครบถ้วน:** เมื่อเพิ่มข้อความใหม่ ต้องเพิ่มทั้งภาษาไทย (`th`) และภาษาอังกฤษ (`en`) ให้ครบทุกคู่เสมอ (100% Key Parity)
- Comment ในโค้ดใช้ **ภาษาอังกฤษ** (ยกเว้น Business Logic เฉพาะทางที่ซับซ้อน เช่น สูตรราคารายชั่วโมง/มิเตอร์หมุนครบรอบ/ภาษีไทย สามารถใช้ภาษาไทยกำกับได้)
- ชื่อตัวแปร, Function, Method, Class, DTO, Type และ Interface ใช้ **ภาษาอังกฤษ** เสมอตามแบบแผนสากลและตรงตามคำศัพท์ใน [CONTEXT.md](./CONTEXT.md)

---

## 2. Reuse First Policy (ใช้ของเดิมก่อนเสมอ & Global Reuse)

- **สำรวจของกลางก่อนเสมอ:** หากส่วนไหนที่มี Components (`src/components/ui/`, `src/components/forms/`, `src/components/layout/`), Hooks (`src/hooks/`), Helper functions, หรือ Utility กลางอยู่แล้ว ให้นำมาใช้ทันที ห้ามเขียนโค้ดซ้ำซ้อน (No Duplicate Logic)
- **เสนอแนะเพื่อทำ Global Reuse:** หากจำเป็นต้องสร้างฟังก์ชัน, Hook หรือ Component ที่ยังไม่มีในระบบ และมีโอกาสนำไปใช้ซ้ำในจุดอื่นได้ ให้เสนอแนะแนวทางการทำเป็น Global Reusable แก่ผู้ใช้ทราบก่อนลงมือสร้าง
- **ห้าม Duplicate Logic:** หากมีโค้ดหรือคอมโพเนนต์ที่ทำงานใกล้เคียงกัน ให้พิจารณา Reuse หรือ Extend จากของเดิม
- **Global Single Source of Truth:** ข้อมูลคงที่ระดับระบบและ Master Data กลาง ต้องดึงจากศูนย์กลางเสมอ ห้ามประกาศซ้ำใน Feature:
  - ข้อมูลชื่อระบบ เว็บไซต์ สโลแกน: ดึงจาก `src/config/site.ts` (`siteConfig.name = "tan-pms"`)
  - ข้อมูลสาขา รหัสเอกสาร 9 หมวด โหมดการพัก คอนฟิกมัดจำ: ดึงจาก `src/constants/master-data.ts` (`CENTRAL_PROPERTIES`, `STAY_MODES`, `DOCUMENT_PREFIXES`, `HOLD_PAYMENT_CONFIG`)

---

## 3. Scope Guardrails & Minimal Blast Radius

- **Minimal Blast Radius:** แตะเฉพาะไฟล์ที่เกี่ยวกับ Task โดยตรง ห้าม refactor, จัดระเบียบ หรือแก้ format ไฟล์ที่ไม่เกี่ยวข้อง
- **Commit message format:** `type(scope): description`
  - type: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`
  - ตัวอย่าง: `feat(stays): enforce clean unit condition before hourly check-in`
- **Do Not Commit:**
  - ห้าม commit `.env`, `.env.local`, tokens, credentials, connection strings หรือ secrets
  - ห้าม commit โฟลเดอร์ build/cache: `bin/`, `obj/`, `.next/`, `node_modules/`, `dist/`, `TestResults/`

---

## 4. Documentation workflow

1. Identify the reader and the decision or task the document supports.
2. Update the authoritative document listed in [docs/README.md](./docs/README.md).
3. Keep relative Markdown links accurate and case-sensitive across macOS and Linux CI.
4. Run `npm run verify:docs` to verify that all required governance files, 20 Ubiquitous Language terms, 9 Document prefixes (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`), `PM-01`–`PM-10` slices, and relative links pass 100%.
5. Summarize the decision and list every changed document.

---

## 5. Preview & Mockup rules

- Keep [preview.html](./preview.html) faithful to [design.md](./design.md) (**Ollama Minimal Design System**).
- Every visual section needs accessible labels, `40px`/`44px` touch targets, AAA/AA contrast (especially white `#ffffff` headings inside `.inverted-card` `#171717`), and zero nested bordered cards.
- Verify [preview.html](./preview.html) with `impeccable detect --json preview.html` (must return `[]` with 0 warnings and 0 advisories).

---

## 6. PMS Form, List & UX Standards (Ollama Minimal Design System & `shadcn/ui`)

> ศึกษาคู่มือละเอียดเพิ่มเติมได้ที่ `.agents/skills/building-pms-forms/SKILL.md` (ฟอร์มบันทึกข้อมูล), `.agents/skills/building-pms-lists/SKILL.md` (ตารางรายการข้อมูลและ Table-Preserved Architecture) และข้อกำหนดด้านการออกแบบที่ [design.md](./design.md)

- **Official shadcn/ui First Policy with Ollama Tokens:**
  - ส่วนประกอบ UI มาตรฐานทุกตัว (`Dialog`, `AlertDialog`, `Select`, `Tooltip`, `DropdownMenu`, `Popover`, `Sheet`, `Tabs`, `Table`, `Button`, `Input`) ต้องใช้/ติดตั้งผ่าน Official `shadcn` CLI (`npx shadcn@latest add <component>`) และ Radix Primitives เป็นฐานรากเท่านั้น
  - ห้ามเขียน Custom Modal Overlay (`<div role="dialog"...>`) หรือ Custom CSS Tooltip เองเด็ดขาด เพื่อความถูกต้องด้าน Accessibility (a11y), Keyboard Trap, Focus Management และ z-index Portals
  - ปรับแต่ง Class ให้สอดคล้องกับ Ollama Minimal Design System: Interactive Elements เป็นแคปซูล `rounded-full`, กล่อง/การ์ด/Dialog เป็น `rounded-[12px]`, เส้นขอบ `border-hairline`, และตัดเงาฟุ้งเป็น `shadow-none`
- **Strict Semantic Tokens & Zero Arbitrary Hex:**
  - ห้ามมี Arbitrary Hex Classes (`(text|bg|border|ring|divide)-[#...]`) ทั้งใน `.tsx` และใน `preview.html` เด็ดขาด ทุกสีต้องผูกกับ Semantic Tokens ใน `tailwind.config.ts` (`text-ink`, `bg-canvas`, `border-hairline`, `text-body`, `text-mute`, `text-charcoal`, `bg-surface-soft`, `bg-surface-dark`, `text-destructive`)
- **Visual Theme & Design Tokens (Ollama Minimal Design System):** ยึดมั่นตาม [design.md](./design.md) และ [ADR-0003](./docs/adr/0003-ollama-design-system-and-shadcn.md):
  - **Palette:** พื้นหลังหลักขาวบริสุทธิ์ `#ffffff` (`canvas`), พื้นผิวรอง `#fafafa` (`surface-soft`), สีหลักดำบริสุทธิ์ `#000000` (`primary`, กด `#090909`), เส้นขอบบาง `#e5e5e5` / `#d4d4d4` และอนุญาตให้มีการ์ดสีเข้ม `#171717` (`surface-dark` / `InvertedCard`) ได้ไม่เกิน **1 จุดต่อหน้า** เท่านั้น
  - **Shape Geometry:** ทุกองค์ประกอบที่คลิกหรือกรอกข้อมูลได้ (Buttons, Inputs, Selects, Search Pills, Filter Chips, Command Tags, TabsTriggers) ใช้มุมโค้งแคปซูล `9999px` (`rounded-full`); การ์ดข้อมูล ตาราง โมดอล และ `TerminalCard` ใช้มุมโค้ง `12px` (`rounded-[12px]` / `rounded-lg`) เส้นขอบ `1px solid #e5e5e5` ไม่มีเงาฟุ้ง (`shadow-none`) และห้ามซ้อนการ์ดมีขอบไว้ในการ์ดมีขอบอีกชั้น (No Nested Bordered Cards)
  - **Typography:** หัวข้อใหญ่ใช้ `SF Pro Rounded`, เนื้อหาและป้ายกำกับใช้ `ui-sans-serif`, และรหัสเอกสาร/เวลาถอยหลัง/เลขมิเตอร์/จำนวนเงินใช้ `ui-monospace` (`tabular-nums`)
- **Single Dynamic Route `[id]`:** ใช้หน้าเดียวรองรับทั้ง Create (`id="create"` หรือ `"add"`) และ Edit (`id` จริง)
- **Deferred File Upload (`useDeferredFileUpload`):** เมื่อเลือกไฟล์แนบ/รูปภาพ (สลิปโอนเงิน, รูปบัตรประชาชน, รูปมิเตอร์น้ำ-ไฟ, รูปแจ้งซ่อม `WorkOrder`, รูปพัสดุ `Parcel`) ให้อัปโหลดจริงในฟังก์ชัน `onSubmit` เท่านั้น ห้ามยิง API อัปโหลดทันทีที่เลือก เพื่อป้องกันไฟล์ขยะค้างในระบบ และ**ต้องใช้ Custom Hook กลาง `useDeferredFileUpload` เสมอ** (ห้ามยิง `fileClient` ดิบใน Form Components)
- **Double Submit Protection:** ปุ่มบันทึก/ส่งข้อมูลต้องมีสถานะ `isLoading` และถูก Disable ทันทีขณะยิง Request
- **Safety Confirmation Modal (`ConfirmationModal`):** การลบ (Delete), การยกเลิกบิล (`Void` / `Cancel`), การอนุมัติคืนเงินประกัน, การปิดกะแคชเชียร์ที่มีผลต่าง หรือการ Override เปิดห้องสถานะ `Dirty` ต้องมี `ConfirmationModal` ยืนยันเสมอ พร้อมทั้งปุ่มยืนยันใน Modal ต้องมี `isLoading` ล็อกปุ่มไว้ขณะยิง API
- **Minimal Mono Loading:** ขณะดึงข้อมูล Edit ให้ใช้ Minimal Loading Component (`MonoSpinner` / `PageLoading`) ในคอนเทนเนอร์ (ห้ามใช้ Skeleton Loader ที่กระพริบหลอกตา)
- **Tabbed Form Architecture (`FormTabs` & `useFormTabErrors`):** สำหรับฟอร์มที่มีข้อมูลหลายกลุ่มเพื่อลดการ scroll ให้ใช้ `<FormTabs />` กลาง พร้อม Red Dot Error Indicator (`#ff5f56`) บนหัวแท็บ, Auto-Switch ไปแท็บแรกที่มี Error เมื่อ submit ไม่ผ่าน, อิสระในการคลิกสลับแท็บ (Unrestricted) และซ่อนด้วย CSS `hidden` เพื่อรักษา DOM input registration
- **Strict Input Height Harmony & Density Tokens:** ช่องกรอกข้อมูลทุกประเภท ทั้ง `<Input>`, `<SelectPill>`, `<EntityAutocomplete>` ในระดับกริดเดียวกันต้องมีความสูงสม่ำเสมอเท่ากันอย่างเข้มงวด โดยอ้างอิงตาม Control Height Token (`var(--pms-control-h)` ซึ่งในโหมดมาตรฐานคือ `h-10 min-h-[40px]` หรือ Spacious `h-11 min-h-[44px]` และ Compact `h-9 min-h-[36px]`) พร้อมขนาดฟอนต์ `text-sm` สม่ำเสมอ และใส่ `wrapperClassName="!mb-0"` เมื่ออยู่ใน Grid
- **Top-Right Field Actions:** ปุ่มหรือลิงก์สร้างข้อมูลใหม่/ช่วยเหลือประจำฟิลด์ (เช่น `[สร้างลูกค้าใหม่]`, `[คำนวณตามแพ็กเกจ]`) ต้องจัดวางที่มุมขวาบนของ Input ในระนาบเดียวกับ Label เสมอ (`flex items-center justify-between min-h-[20px] mb-1.5`) ห้ามปล่อยให้ห้อยอยู่ใต้ Input
- **Icon-First Adjacent Field Actions with Tooltip (`size="icon"` + `<Tooltip />`):** ปุ่ม Action ที่อยู่ระนาบเดียวกับ Input/Select (เช่น ปุ่ม Quick-Add Master Data `+`, ปุ่มสุ่มรหัส, ปุ่มค้นหา):
  1. ต้องใช้ **Icon-only Button (`size="icon"` `rounded-full` ล็อกความสูงเท่ากับช่องกรอก เช่น `h-10 w-10` หรือ `h-11 w-11`)** เสมอ ห้ามเขียนข้อความยาวๆ เช่น `[+ เพิ่ม]` เพื่อประหยัดพื้นที่แนวนอนและป้องกันข้อความตกบรรทัด
  2. ต้องครอบด้วย `<Tooltip content="..." position="top">` พร้อมใส่ `aria-label` ทุกครั้ง เพื่อคงความสามารถในการเข้าถึง (Accessibility)
  3. คอนเทนเนอร์ Input/Select ต้องใส่ `wrapperClassName="!mb-0"` และจัดแนวแถวด้วย `flex items-center gap-2` เพื่อล็อกขอบบนและล่างให้ขนานกับช่องกรอกพอดีเป๊ะ
- **Name-First Dropdown Hierarchy:** การแสดงผลใน Autocomplete / Select ต้องแสดงชื่อรายการเป็นหลัก (Name-First) ตัวหนาชัดเจน ควบคู่กับรหัส Code (เช่น `สมชาย ใจดี (CUS-00088)`, `A-301 — Deluxe 32 ตร.ม.`) ห้ามแสดงเฉพาะรหัสตัวเลขเดี่ยวๆ
- **Table-Preserved Form Input Balance & Primary Action Prominence:**
  1. ในฟอร์มแบบตารางรายการ (Dynamic Array / Table Rows เช่น ตารางจดมิเตอร์น้ำ-ไฟ `PM-07` หรือรายการ `InvoiceLine`) ช่อง Input ทุกคอลัมน์ต้องระบุความสูงสม่ำเสมอพร้อม `wrapperClassName="!mb-0"` และจัดแนวแถวตารางเป็น `align-middle`
  2. หากคอลัมน์ใดมี Sub-label ด้านล่าง (เช่น ข้อความระบุหน่วย `หน่วย: kWh` หรือป้ายเตือน `Rollover`) ให้ใส่ Spacer ล่องหน (`<span className="invisible select-none" aria-hidden="true">-</span>`) ในคอลัมน์ข้างเคียง เพื่อรักษาสมดุลความสูงกล่อง ให้ทุก Input และปุ่ม Action ขนานในระนาบแนวนอนเดียวกันพอดีเป๊ะ
  3. ปุ่ม Action หลักสำหรับเพิ่มรายการเข้าตาราง (เช่น `+ เพิ่มรายการค่าใช้จ่าย`, `+ เพิ่มผู้พักร่วม`) ต้องใช้ `variant="default"` (สีดำหลัก `#000000` `rounded-full`) เสมอ ห้ามใช้ `variant="outline"` หรือ `variant="ghost"` เพื่อให้โดดเด่นและมองเห็นชัดเจน
- **Single-Row Architectural Card Header (Zero-Void Standard):** สำหรับการ์ดข้อมูลหรือ Array รายการที่สามารถเปิด-ปิดย่อ/ขยายได้ (Collapsible Cards):
  1. หัวการ์ดต้องจัดอยู่ในแถวเดียวแบบกะทัดรัด (Single Compact Row) ประกอบด้วย: ปุ่มเปิด-ปิด, รหัสข้อมูลหลัก, ชื่อข้อมูลหลัก, Badge สรุปจำนวน และปุ่ม Action
  2. ชื่อข้อมูลหลัก (Primary Name/Title) ต้องมองเห็นได้เสมอแม้จะอยู่ในสถานะย่อ (Collapsed) ห้ามนำไปซ่อนไว้ด้านในการ์ด และห้ามปล่อยให้เกิดช่องว่างขนาดใหญ่ (Empty Void)
- **Zero-Layout-Shift for Live Calculation/Conversion Cells:** ในฟอร์มตารางที่มีการคำนวณสด (เช่น ตารางจดมิเตอร์น้ำ-ไฟ `Usage = Current - Previous` และยอดเงิน):
  1. คอนเทนเนอร์ข้อความผลลัพธ์ย่อยต้องล็อกความสูงขั้นต่ำคงที่ (`mt-1 min-h-[16px]`) และหากยังไม่มีผลลัพธ์ให้แสดงตัวคั่นล่องหน `<span className="invisible select-none" aria-hidden="true">-</span>` เสมอ
  2. คอลัมน์ข้างเคียงทุกคอลัมน์ในแถวเดียวกันต้องใส่ Invisible Spacer ความสูงเดียวกันกำกับไว้ เพื่อล็อกความสูงของแถวไม่ให้เด้งขึ้นเด้งลง (Zero Bouncing)
- **DOM-Preserved Collapsible Sections:** การเปิด-ปิดซ่อนเนื้อหาฟอร์ม (Expand/Collapse หรือ Tab Panels) ต้องใช้ CSS `className={cn("...", !isExpanded && "hidden")}` เสมอ ห้ามใช้ `{isExpanded && <Fields />}` เพื่อรักษาการลงทะเบียน (Register) และค่าฟิลด์ใน React Hook Form ให้ครบถ้วนสมบูรณ์
- **Mandatory Input Placeholder Coverage & i18n:** ช่องกรอกข้อมูลทุกประเภททั้ง `<Input>`, `<Textarea>` ต้องระบุ `placeholder` เสมอ (ยกเว้น hidden, checkbox, radio, file, color, range) โดยข้อความต้องดึงผ่านระบบแปลภาษา (`i18n`) ครบทั้งสองภาษา (`th` และ `en`) เสมอ ห้ามปล่อยว่างหรือ Hardcode เด็ดขาด
- **Table Cell Flow Integrity (Zero Table Shifting):** ห้ามใส่คลาส `sr-only` ลงบนแท็ก `<th>`, `<td>`, `<TableHead>` หรือ `<TableCell>` โดยเด็ดขาด เพราะ `sr-only` ใช้ `position: absolute` ซึ่งจะตัดเซลล์นั้นออกจาก Table Flow ทำให้จำนวนคอลัมน์ของ `<thead>` และ `<tbody>` คลาดเคลื่อนและตารางเบี้ยว หากต้องการซ่อนข้อความคอลัมน์ ให้ใส่ `<span className="sr-only">ข้อความ</span>` *ภายใน* เซลล์เสมอ
- **Modal Header Clean Focus (No Hover/Focus Artifacts):** ปุ่ม Action หรือปุ่มปิดบนแถบ Header ของ Modal ห้ามครอบด้วย `<Tooltip>` ที่เปิดอัตโนมัติเมื่อได้รับ Focus เพราะ Focus Trap ของ Modal จะกระโดดไปโฟกัสปุ่มแรกทันทีที่เปิด ทำให้ Tooltip เด้งค้าง ให้ใช้ `title="..."` และ `aria-label="..."` แทน
- **Table-Preserved List Architecture:** ในหน้าตารางรายการ ห้ามสลับ `<DataTable />` ออกเมื่อเกิด Error หรือค้นหาไม่พบข้อมูล (`{isError ? <Error /> : <DataTable />}` เป็นสิ่งต้องห้าม) ต้องคง `<DataTable />` และหัวตาราง `<thead>` ไว้บนหน้าจอเสมอ แล้วส่ง props `isLoading`, `isError`, `error`, `onRetry` เข้าไปแสดงภายใน `<tbody>`

---

## 7. Application & Clean Architecture Guardrails

> อ่านเอกสารและคู่มือมาตรฐานเหล่านี้เมื่อทำงานในส่วน Application:
> - มาตรฐานการทำฟอร์ม: `.agents/skills/building-pms-forms/SKILL.md`
> - มาตรฐานตารางรายการ: `.agents/skills/building-pms-lists/SKILL.md`
> - มาตรฐานการทำ API: `.agents/skills/building-pms-apis/SKILL.md`
> - มาตรฐานเลขที่เอกสาร 9 หมวด: `.agents/skills/pms-document-numbering/SKILL.md`
> - มาตรฐานการกระจายงาน Subagents: `.agents/skills/tiered-orchestration/SKILL.md`
> - Backend Architecture: [docs/02-architecture/backend-architecture.md](./docs/02-architecture/backend-architecture.md)
> - Frontend Architecture: [docs/02-architecture/frontend-architecture.md](./docs/02-architecture/frontend-architecture.md)
> - API, Errors & RBAC Scopes: [docs/03-contracts/api-conventions.md](./docs/03-contracts/api-conventions.md), [docs/03-contracts/error-contract.md](./docs/03-contracts/error-contract.md), [docs/03-contracts/rbac-and-scopes.md](./docs/03-contracts/rbac-and-scopes.md)
> - Data, Locking & PDPA: [docs/04-data/database-and-locking-standards.md](./docs/04-data/database-and-locking-standards.md), [docs/04-data/pdpa-and-audit-redaction.md](./docs/04-data/pdpa-and-audit-redaction.md)

### Backend (`.NET 10` C# Clean Architecture)
- **แบ่ง 4 โครงการย่อยชัดเจน:** `TanPms.Domain`, `TanPms.Application`, `TanPms.Infrastructure`, `TanPms.WebApi` พร้อม `DomainMarker.cs`, `ApplicationMarker.cs`, `InfrastructureMarker.cs`, `ApiMarker.cs`
- **Vertical Feature Folders & One Type Per File (ห้ามรวมโค้ดหลายคลาสไว้ในไฟล์เดียว):**
  - ใน `TanPms.Domain` และ `TanPms.Application` ต้องแยกโฟลเดอร์ตามหมวดธุรกิจ (`Common/`, `DocumentNumbering/`, `Properties/`, `Customers/`, `Rates/`, `Reservations/`, `Stays/`, `Leases/`, `Meters/`, `Billing/`, `Cashier/`, `Operations/`, `Rack/`, `ClientPortal/`)
  - **ห้าม** เทรวม Entities, Enums หรือ Services หลายตัวไว้ในไฟล์เดียว (เช่น ห้ามสร้าง `DomainEntities.cs` หรือ `DomainEnums.cs` ขนาดยักษ์) ต้องแยก **1 Public Class / Record / Enum ต่อ 1 ไฟล์** เหมือน `tan-erp`
- **No Business Logic in Controllers / Endpoints:** Logic ทั้งหมดต้องอยู่ใน Application Use Case Handlers (`Command` / `Query` / `Handler` ที่คืนค่า `Result<T>`) หรือ Domain Entities/Calculators
- **Hybrid Data Access & Locking:**
  - `EF Core 10` เป็นเจ้าของ Writes, Transactions, Migrations และ `AuditableEntityInterceptor`; `Dapper` ใช้สำหรับ Complex Reads
  - การจองและเปิดห้องพักต้องป้องกันการจองซ้อนด้วย `PostgreSQL tstzrange` + `EXCLUDE USING gist` และจัดการ `Hold` ที่มี `HoldExpiresAt` (TTL 15 นาที)
- **RFC 9457 Problem Details & Localized `.resx`:**
  - ทุก Error Response ต้องผ่าน `ProblemDetailsMapper` และ `ApiProblemDetails` ตามมาตรฐาน RFC 9457 (`type`, `title`, `status`, `detail`, `instance`, `code`/`errorCode`, `traceId`) พร้อมดึงข้อความ 2 ภาษาจาก `Resources/Errors.resx` (ไทย) และ `Resources/Errors.en.resx` (อังกฤษ)
- **Localized `jsonb` Text Contract (`LocalizedText` `{ "th": string, "en"?: string }`):**
  - ฟิลด์ชื่อและคำอธิบายหลายภาษาของ Master Data (`Property.Name`, `Property.Address`, `Building.Name`, `Floor.Name`, `UnitType.Name`, `UnitType.Description`, `UnitAsset.Name`, `HourlyRateRule.Name`) และ Snapshot รายการในบิล (`FolioCharge.Description`, `InvoiceLine.Description`) ต้องใช้ Value Object `LocalizedText` และเก็บลงฐานข้อมูล PostgreSQL เป็น `jsonb` รูปทรงคงที่ `{"th": "...", "en": "..."}` ผ่าน EF Core `ValueConverter` ตาม [ADR-0004](./docs/adr/0004-localized-jsonb-for-master-data-text.md)
  - ต้องตั้งค่าผ่าน `ConfigureConventions(ModelConfigurationBuilder)` ใน `TanPmsDbContext` โดยใช้ `LocalizedTextValueConverter` และ `OptionalLocalizedTextValueConverter` เพื่อให้ทุกฟิลด์ใน Child Entities แปลงลง `jsonb` อัตโนมัติ ป้องกันปัญหา Unkeyed Entity Error
  - ฟิลด์ที่มีผลต่อการคำนวณ สถานะ รหัสเอกสาร (`Code`, `UnitNumber`, `DocumentNumber`) และชื่อบุคคลตามบัตรประชาชน (`Customer.FullName`, `Occupant.FullName`) คงไว้เป็น Relational Typed Columns ปกติ

### Frontend (`Next.js App Router` + `TypeScript Strict` + `shadcn/ui`)
- **Strict TypeScript & Zero `any`:** ห้ามใช้ type `any`, `as any` หรือ `@ts-ignore` เด็ดขาด กำหนด DTO / Interface จาก `src/generated/api/tan-pms.v1.ts` หรือใช้ `unknown` แล้ว narrow
- **Localized Text Resolution Helper (`resolveLocalizedText`):** ฟิลด์ `LocalizedTextDto` จาก API (`{ th: string, en?: string | null }`) ต้องแสดงผลผ่าน Helper กลาง `resolveLocalizedText(value, locale)` (`src/lib/i18n/localized-text.ts`) เสมอ ห้ามเข้าถึงฟิลด์ `.th` ดิบใน UI โดยตรง
- **Strict Error Handling & No Arbitrary Fallback:** ห้ามดักจับหรือเปรียบเทียบ Error ด้วย String message ดิบ และ**ห้ามทำ Loose / Arbitrary Fallback ต่อกันเป็นลูกโซ่เด็ดขาด** (เช่น `valA || valB || valC` หรือเดา field อื่นมาแสดงแทนเมื่อไม่มีข้อมูล) ต้องยึดถือ Single Source of Truth ตาม Structured Contract เท่านั้น หากไม่มีข้อมูลให้แสดงสถานะว่างตามมาตรฐาน (`-`)
- **No FE Find Logic & Backend Structured Projection:** ข้อมูลความสัมพันธ์ที่ต้องใช้แสดงผลบนหน้าจอ (เช่น `property`, `unit`, `customer`) ต้องถูกโปรเจกต์เป็น Nested Object จาก Backend มาใน Response โดยตรง (เช่น `unit: { id, unitNumber, buildingName, floorNumber }`, `customer: { id, fullName, maskedNationalId }`) **ห้ามส่งคืนเฉพาะ Foreign Key UUID ดิบ แล้วเขียน logic `array.find(...)` จับคู่ข้อมูลเองที่ Frontend เด็ดขาด**
- **Backend-Driven Metadata & Single Source of Truth (No FE String Hacking):** เมื่อต้องการจัดกลุ่มทางธุรกิจ, แสดงหมวดหมู่ หรือจำแนกสถานะ ต้องส่งเป็น Structured Metadata หรือ Boolean Flags จาก Backend DTO เสมอ **ห้ามเขียนโค้ด Parse string ดิบ เช่น `key.split('.')` เองที่ Frontend เด็ดขาด**
- **Central UI Components First (Zero Raw HTML Controls):** ในหน้าฟอร์ม, หน้าแสดงผล (`src/app/**`) และฟีเจอร์ (`src/features/**`) **ห้ามใช้แท็ก HTML ดิบเด็ดขาด** (เช่น `<input>`, `<select>`, `<textarea>`, `<table>`, `<p role="alert">`, `<button>` ลอยๆ) ให้ใช้คอมโพเนนต์ `shadcn/ui` กลางจาก `@/components/ui/*`, `@/components/forms/*`, `@/components/layout/*` เสมอ:
  - `<Button />`, `<Input />`, `<Label />`, `<SelectPill />`, `<Badge />`, `<CommandTag />`
  - `<Card />`, `<InvertedCard />`, `<TerminalCard />`
  - `<Table />`, `<TableHeader />`, `<TableBody />`, `<TableRow />`, `<TableHead />`, `<TableCell />` และ `<DataTable />`
  - `<FormTabs />`, `<FormSection />`, `<DeferredFilePicker />`
  - `<Alert />`, `<EmptyState />`, `<ConfirmationModal />`, `<Tooltip />`, `<PageHeader />`
- **Direct Sub-path Imports for Core UI:** ใน Form Components และ Feature Components ให้ใช้ Direct Sub-path Import (เช่น `import { Button } from "@/components/ui/button";`, `import { Input } from "@/components/ui/input";`) หลีกเลี่ยง Barrel Import ดิบจาก `@/components/ui`
- **Feature Colocation (`src/features/<feature>/`):**
  - ห้ามเทรวม UI และ Business Logic หลายร้อยบรรทัดไว้ในไฟล์ `src/app/(admin)/admin/page.tsx` หรือ `src/app/(client)/client/page.tsx`
  - ไฟล์ `page.tsx` ใน `src/app/` ต้องทำหน้าที่เป็น Thin Route Entry ที่ประกอบคอมโพเนนต์จาก `src/features/<feature>/components/` เท่านั้น โดยในแต่ละ Feature แยกย่อยเป็น `api/`, `components/`, `schemas/`, `types/`
- **TanStack Query & Central `ApiClient`:** ให้ `TanStack Query` เป็นเจ้าของ Server State และติดต่อผ่าน `src/lib/api/api-client.ts` เท่านั้น ห้ามใช้ `fetch` ดิบใน `useEffect`

---

## 8. Definition of Done & Verification Before Completion

- การเปลี่ยนแปลงอยู่ในขอบเขตงานที่ได้รับมอบหมาย และไม่กระทบต่อโค้ดส่วนอื่น
- ผ่าน Verification Gates ก่อนส่งมอบงานเสมอ:
  ```bash
  # 1. Governance & Documentation Gate
  npm run verify:docs

  # 2. Backend Gates (.NET 10)
  dotnet build backend/TanPms.slnx
  dotnet test backend/tests/TanPms.UnitTests --no-build
  dotnet test backend/tests/TanPms.ArchitectureTests --no-build
  dotnet test backend/tests/TanPms.IntegrationTests --no-build

  # 3. Frontend Gates (Next.js + Strict TS + Vitest)
  cd frontend
  npm run generate:api
  npm run lint
  npx vitest run
  npm run build
  ```
- **Automated Code Hygiene Enforcement (`code-hygiene.test.ts`):** ในฝั่ง `frontend/` ต้องรันผ่านชุดทดสอบ `code-hygiene.test.ts` เสมอ เพื่อยืนยันว่า:
  1. ไม่มีคำต้องห้าม `: any`, `as any`, `<any>`, `@ts-ignore`, `@ts-expect-error`
  2. ไม่มีตัวอักษรภาษาไทย (`[\u0E00-\u0E7F]`) หลุดในไฟล์ `.tsx` ทุกไฟล์ (ภาษาไทยต้องอยู่ใน `src/messages/th.json` เท่านั้น)
  3. ไม่มีแท็ก HTML ดิบ (`<button`, `<input`, `<select`, `<textarea`, `<table`) ใน `src/app/` และ `src/features/`
  4. คีย์ใน `th.json` และ `en.json` ตรงกัน 100% ทุกระดับ
  5. ไม่มี Arbitrary Hex Color Classes (`[#...]`) ทั้งในไฟล์ `.tsx` และใน `preview.html` เด็ดขาด (ต้องใช้ Semantic Tokens เท่านั้น)
- **ห้ามกล่าวอ้างว่างาน "เสร็จแล้ว" หรือ "ผ่านแล้ว" หากยังไม่ได้รันคำสั่ง Verify และยืนยันผลลัพธ์จริงจาก Terminal**

---

## 9. Efficient Workflow (ลดเวลาทำงาน โดยไม่ลดมาตรฐานโค้ด)

> หมวดนี้ปรับ **วิธีทำงาน** เท่านั้น ไม่เปลี่ยนกฎการเขียนโค้ดในหมวด 1–8 (strict types, i18n `th`/`en`, Reuse First, No FE Find, No Arbitrary Fallback, Clean Architecture, One Type Per File, Feature Colocation, Definition of Done) ซึ่งยังบังคับเหมือนเดิมทุกข้อ

- **Targeted reading:** `AGENTS.md` และ `design.md` อ่านทุกงานเสมอ ส่วนเอกสารอื่น (`CONTEXT.md`, roadmap, plan, `.agents/skills/*`) อ่านเฉพาะที่เกี่ยวกับงานนั้น (เช่น งานฟอร์มอ่าน `building-pms-forms` ไม่ต้องอ่าน `building-pms-apis`)
- **Tiered verification (ระหว่างทำ vs ก่อนส่งมอบ):**
  - ระหว่างพัฒนา: รันเฉพาะส่วนที่แตะ เช่น `dotnet test --filter <ชื่อ test>`, `npx tsc --noEmit`, `npx vitest run <ไฟล์ที่แก้>`
  - ก่อนส่งมอบ: รัน Gate เต็มตามหมวด 8 **ครั้งเดียว** ห้ามข้าม และห้ามอ้างว่าเสร็จจากผล Gate ย่อยเท่านั้น
- **Fast path สำหรับงานเล็ก:** typo, แก้ข้อความ i18n, rename ภายในไฟล์เดียว ไม่ต้องทำ brainstorming/plan เต็มรูปแบบ ลงมือแก้แล้วรัน Gate ที่เกี่ยวข้อง (i18n ต้องเติมครบ `th`/`en` เสมอ)
- **Full process สำหรับงานใหญ่:** Feature ใหม่, เปลี่ยน Business Rule, เปลี่ยน Schema/Contract ให้ทำ plan ตามแผนของ slice ก่อนเริ่ม
- **แยกงานขนาน (`/tiered-orchestration`):** slice ที่ไม่แตะไฟล์ร่วมกัน (`backend/` vs `frontend/`) แยก Subagent ตามระดับโมเดล (`inherit` สำหรับ Backend และ `flash` สำหรับ Frontend) ได้ แต่ตัวหลักต้องรวมและรัน Gate เต็มหนึ่งรอบก่อนส่งมอบเสมอ
- **Batch การแก้:** แก้ DTO → Handler → OpenAPI Contract → FE Type → i18n ให้ครบในรอบเดียว แล้วค่อย build เพื่อลดรอบ fail ซ้ำ
