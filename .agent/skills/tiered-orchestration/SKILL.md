---
name: tiered-orchestration
description: รูปแบบการสั่งงานแบบแยกชั้นโมเดลและทำงานคู่ขนาน (Tiered Subagent Orchestration) สำหรับโปรเจกต์ tan-pms โดยใช้โมเดลใหญ่ (Gemini 4 Argon / inherit / pro) กับงาน Backend Domain/Concurrency/Availability Engine ที่ซับซ้อน และโมเดลประหยัดความเร็วสูง (Gemini Flash) กับงาน Frontend UI/Forms/Ollama Minimal Design System/i18n ช่วยประหยัด Token สูงสุด ควบคุม Context Window และคงคุณภาพโค้ดระดับ Production
---

# Tiered Subagent Orchestration (`tan-pms`)

คู่มือและมาตรฐานการสั่งงานแบบกระจายงานให้ Subagents ตามระดับความซับซ้อน (Tiered Model Orchestration) พร้อมการทำงานคู่ขนานแบบไม่ชนไฟล์ (Disjoint Workspaces) สำหรับโปรเจกต์ **`tan-pms` (Enterprise Property Management System)**

---

## 🎯 1. เมื่อใดที่ควรใช้ (When to Trigger)

ใช้รูปแบบนี้ทันทีเมื่อ:
- ผู้ใช้สั่งว่า: *"สั่งงานแบบ tiered"*, *"ใช้ tiered subagents"*, *"ทำแผนแล้วโยนงานให้ subagents"*, *"แยกโมเดลตามความเหมาะสม"*, หรือเรียก `/tiered-orchestration` / `$tiered-orchestration`
- มีงานขยายโมดูลใหม่ หรือพัฒนา Vertical Slice (`PM-01` ถึง `PM-10`) ที่ครอบคลุมทั้ง **Backend (.NET 10 Clean Architecture, Concurrency Locks, Domain Logic, EF Core/Dapper, API)** และ **Frontend (Next.js App Router, Ollama Minimal Design System, Forms, Tables, i18n)**
- ต้องการประหยัด Token และป้องกันไม่ให้ Context Window ของตัวหลักบวมจาก Log และโค้ดจำนวนมาก

---

## 🏗️ 2. กฎการจัดสรรโมเดล (Model Allocation Matrix)

| สายงาน (Work Track) | ขอบเขตไฟล์ | ระดับโมเดลที่ใช้ (`invoke_subagent`) | บทบาทและความรับผิดชอบ |
|---|---|---|---|
| **Backend Specialist** | เฉพาะ `backend/` | **`Model: "inherit"`** หรือ **`"pro"`** *(Gemini 4 Argon)* | ดูแล Business Logic ซับซ้อน, 3 StayModes (`Hourly`, `Daily`, `Monthly`), Availability Engine (`tstzrange` + `EXCLUDE USING gist`), Concurrency Locks (`Hold TTL 15 นาที`), สูตรคำนวณมิเตอร์น้ำ-ไฟ/เรตราคา/ภาษี, `AdminScope` vs `ClientScope`, RFC 9457 Problem Details และ Integration Tests กับ Testcontainers |
| **Frontend Specialist** | เฉพาะ `frontend/` | **`Model: "flash"`** *(Gemini Flash)* | ดูแล UI Components ตามระบบ **Ollama Minimal Design System** (พื้นขาว `#ffffff`, สีหลัก `#000000`, แคปซูล `rounded-full`, การ์ด `rounded-lg` ขอบบาง 1px, สูงสุด 1 inverted card `#171717`), Route Groups `(admin)` & `(client)`, `FormTabs` พร้อม Error Indicator, `useDeferredFileUpload`, TanStack Query Hooks, Error Mappers, Zod Schemas และคำแปล 2 ภาษา (`th.json` / `en.json`) |
| **Main Orchestrator** | Root / ทั้งระบบ | **Main Agent** | วางแผนงาน, ควบคุม Scope Guardrails, รัน Sync Point (OpenAPI Contract -> TS Types), ตรวจสอบความสอดคล้องของเอกสาร (`npm run verify:docs`), รีวิวโค้ดและรัน Verification Gates ขั้นสุดท้าย |

---

## 🛡️ 3. กฎเหล็กความปลอดภัยของ Workspace (Disjoint Scope Guardrail)

1. **ห้ามแตะไฟล์ข้ามฝั่งเด็ดขาด:**
   - Subagent ฝั่ง Backend จะได้รับคำสั่งให้แตะเฉพาะโฟลเดอร์ `backend/` ห้ามแตะ `frontend/` หรือ `contracts/`
   - Subagent ฝั่ง Frontend จะได้รับคำสั่งให้แตะเฉพาะโฟลเดอร์ `frontend/` ห้ามแตะ `backend/` หรือรันคำสั่ง backend
2. **OpenAPI Bridge (จุดเชื่อมต่อสัญญา API โดยตัวหลัก):**
   - ห้าม Subagent ฝั่ง Backend อัปเดต OpenAPI ในระหว่างที่ Subagent ฝั่ง Frontend กำลังทำงาน
   - เมื่อ Backend พัฒนา Endpoint เสร็จสมบูรณ์ ให้ **Main Orchestrator** เป็นผู้รันคำสั่ง Generate สัญญาและ Types เพียงผู้เดียว:
     ```bash
     UPDATE_OPENAPI=1 dotnet test backend/tests/TanPms.IntegrationTests --filter "FullyQualifiedName~OpenApiContractTests" --no-build
     cd frontend && npm run generate:api
     ```
   - จากนั้น Main Orchestrator จึงส่งสัญญาณให้ Frontend นำ Types ใน `frontend/src/generated/api/` ไปพัฒนา UI ต่อ

---

## 🔄 4. วงจรการทำงานต่อเนื่อง (Persistent Subagents via `send_message`)

เพื่อประหยัด Token และเวลาตั้งต้นของ Agent **ห้ามสร้าง Subagent ใหม่ทุก Subtask ย่อย**:
1. **รอบแรก (Phase 1):** เรียกใช้ `invoke_subagent` เพื่อสร้าง:
   - Subagent 1 (`Role: "Frontend UI Specialist"`, `Model: "flash"`)
   - Subagent 2 (`Role: "Backend Domain Architect"`, `Model: "inherit"`)
2. **รอบถัดไป (Phase 2, 3, 4...):** ใช้ `send_message` ส่งงานรอบถัดไปให้ Subagent ตัวเดิมที่มี Context ความเข้าใจโปรเจกต์อยู่แล้ว
3. **การรอรับงาน (No Polling):** หลังส่งงานแล้ว ให้จบเทิร์นเพื่อให้ระบบแจ้งเตือน Reactive Wakeup เมื่อ Subagents ทำงานเสร็จ

---

## ✅ 5. ขั้นตอนตรวจสอบความสมบูรณ์ก่อนส่งมอบ (Verification & Gatekeeping)

ก่อนส่งมอบงานให้ผู้ใช้ ตัวหลักต้องปฏิบัติตามมาตรฐาน `AGENTS.md` หมวด 6 และ `docs/05-engineering/definition-of-done.md` เสมอ:

1. **ตรวจเช็ก `git status -s`:**
   - ค้นหาไฟล์ส่วนเกินที่ Subagent อาจสร้างขึ้นมาโดยไม่ได้ตั้งใจ (เช่น duplicate utilities, client-side `.find()` resolution หรือ mock data แปลกปลอม)
2. **รัน Verification Gates เต็มรูปแบบ:**
   ```bash
   # ตรวจสอบเอกสาร ธรรมาภิบาล และสัญญาระบบ
   npm run verify:docs

   # Backend Gates
   dotnet build backend/TanPms.slnx
   dotnet test backend/tests/TanPms.UnitTests --no-build
   dotnet test backend/tests/TanPms.ArchitectureTests --no-build
   dotnet test backend/tests/TanPms.IntegrationTests --no-build

   # Frontend Gates
   cd frontend
   npm run lint
   npm run build
   npx vitest run
   ```
3. **ยืนยันผลลัพธ์จริง:** สรุปรายการไฟล์และตัวเลขผลการทดสอบที่ผ่านจริงให้ผู้ใช้ทราบเป็นภาษาไทยทุกครั้ง

---

## 🔒 6. Zero Hardcode, Zero `any` & LocalizedText Standard

- **LocalizedText (`jsonb` `{ "th": string, "en"?: string }`):** สำหรับ Master Data และ Billing Snapshot ต้องใช้ Value Object `LocalizedText` ใน Backend และแสดงผลผ่าน `resolveLocalizedText(value, locale)` ใน Frontend เสมอ ตาม [ADR-0004](../../../docs/adr/0004-localized-jsonb-for-master-data-text.md)
- **Automated Frontend Hygiene:** Frontend Specialist (`Model: "flash"`) ต้องเขียนและรันผ่าน `code-hygiene.test.ts` เสมอ เพื่อยืนยัน Zero `any`, Zero Thai characters ในไฟล์ `.tsx`, และ Zero Raw HTML Controls ใน `src/app/` และ `src/features/`
