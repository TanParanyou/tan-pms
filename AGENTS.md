# AGENTS.md — กฎเหล็กสำหรับการพัฒนาและ AI Agent (`tan-pms`)

เอกสารนี้คือ **ธรรมนูญสูงสุด (Engineering & Governance Constitution)** ของโปรเจกต์ **`tan-pms` (Enterprise Property Management System)**

ทั้งนักพัฒนาและ AI Agent **ต้อง** อ่านและปฏิบัติตามเอกสารนี้ก่อนแก้ไขโค้ดหรือเอกสารใดๆ ในคลังโค้ดนี้

---

## 1. ตัวตนของระบบและหลักการเอกสาร (System Identity & Documentation Authority)

**`tan-pms`** คือระบบบริหารจัดการที่พักและอสังหาริมทรัพย์ให้เช่าระดับองค์กรสำหรับ **องค์กรเดียวที่มีหลายสาขาและหลายอาคาร (Single-Organization, Multi-Property/Multi-Building)** ที่รองรับการเข้าพักทั้ง **3 รูปแบบ (`StayMode`)** ในระบบเดียว:
- **`Hourly` (รายชั่วโมง)**
- **`Daily` (รายวัน)**
- **`Monthly` (สัญญาเช่ารายเดือน)**

### หลักการ One Authoritative Document per Concern
ห้ามคัดลอกกฎหรือคำนิยามซ้ำซ้อนข้ามไฟล์ ให้ใช้วิธีอ้างอิงไปยังเอกสารเจ้าของเรื่องเสมอ:
- **คำศัพท์โดเมน, รหัสเอกสาร 9 หมวด และ State Machine:** ดูที่ [CONTEXT.md](./CONTEXT.md)
- **ระบบ Design Tokens (Ollama Minimal Design System) และกฎ UI/UX:** ดูที่ [design.md](./design.md) (`DESIGN.md`)
- **เจตนารมณ์และตัวตนของผลิตภัณฑ์:** ดูที่ [PRODUCT.md](./PRODUCT.md)
- **สารบัญและแผนที่เอกสารสถาปัตยกรรมทั้งหมด (`00-overview` ถึง `06-operations` + `adr`):** ดูที่ [docs/README.md](./docs/README.md)

---

## 2. การแบ่งกลุ่มผู้ใช้งานและขอบเขตสิทธิ์ (`admin` vs `client`)

ห้ามใช้คำว่า `staff`, `backoffice`, `portal`, หรือ `member` ในการตั้งชื่อ Route, Policy, โฟลเดอร์ หรือคีย์ภาษา ให้ใช้คู่คำมาตรฐานต่อไปนี้เท่านั้น:

| มิติ | ฝั่งพนักงานและผู้บริหาร (`admin`) | ฝั่งลูกค้าและผู้เช่า (`client`) |
|---|---|---|
| **Frontend Route Group** | `frontend/src/app/(admin)/admin/...` | `frontend/src/app/(client)/client/...` |
| **Backend API Prefix** | `/api/v1/admin/...` | `/api/v1/client/...` |
| **Authorization Scope** | `AdminScope` (`AllowedPropertyIds` + Permission Key) | `ClientScope` (`CustomerId == CurrentUser.CustomerId`) |
| **วัตถุประสงค์หลัก** | ผังห้องรวม, เปิดห้องด่วน, สัญญาเช่า, จดมิเตอร์ยกตึก, กะแคชเชียร์, แม่บ้าน, ช่างซ่อม, รายงานบริหาร | จองห้องออนไลน์ (`Hold TTL`), ดูสัญญา, ดูบิล/มิเตอร์, แนบสลิปโอนเงิน, แจ้งซ่อม, รับแจ้งเตือนพัสดุ |

---

## 3. สถาปัตยกรรมและเทคโนโลยีมาตรฐาน (Approved Tech Stack)

### 3.1 Backend (`.NET 10` — 4-Layer Clean Architecture)
- **`TanPms.Domain`:** Entities, Value Objects, Domain Events, State Machine Invariants, Interfaces พื้นฐาน (ห้ามอ้างอิง EF Core หรือ Library ภายนอก)
- **`TanPms.Application`:** Use Cases / Commands / Queries, Validators (`FluentValidation`), DTOs, `AdminScope` / `ClientScope` Interfaces
- **`TanPms.Infrastructure`:** `EF Core 10` (สำหรับ Writes, Transactions, Migrations, Audit/Soft-Delete Interceptors), `Dapper` (สำหรับ Read Queries ที่ซับซ้อน เช่น Unified Room Rack, Bulk Meter Sheet, Executive Analytics), `PostgreSQL` (`tstzrange` + `EXCLUDE USING gist`), `QuestPDF`
- **`TanPms.WebApi`:** Minimal APIs / Controllers แยกกลุ่ม `/api/v1/admin` และ `/api/v1/client`, `RFC 9457 Problem Details` Exception Handler, OpenAPI Contract Exporter (`contracts/openapi/tan-pms.v1.json`)

### 3.2 Frontend (`Next.js App Router` + `TypeScript Strict`)
- **Framework:** `Next.js` (App Router) + `React 19` + `TypeScript` (`strict: true`, ห้ามใช้ `any` หรือ `as unknown as` เพื่อปิดคำเตือน)
- **UI & Styling:** `Tailwind CSS` + `shadcn/ui` ที่กำหนดค่าตาม **Ollama Minimal Design System** ใน [design.md](./design.md)
- **Data & Forms:** `TanStack Query` + `openapi-typescript` (สร้าง Type จาก `contracts/openapi/tan-pms.v1.json`) + `React Hook Form` + `Zod`
- **Internationalization (`i18n`):** `next-intl` รองรับ 2 ภาษา (`th` เป็นค่าเริ่มต้น และ `en`) ห้าม Hardcode ข้อความภาษาไทยหรืออังกฤษลงใน JSX/TSX

---

## 4. กฎเหล็กด้าน UI/UX และ Ollama Minimal Design System

ทุกหน้าจอใน `tan-pms` ต้องปฏิบัติตาม [design.md](./design.md) อย่างเคร่งครัด:
1. **Palette & Contrast:** ใช้พื้นขาว `#ffffff` (`canvas`), พื้นรอง `#fafafa` (`surface-soft`), สีหลักดำบริสุทธิ์ `#000000` (`primary`), เส้นขอบบาง `#e5e5e5` / `#d4d4d4` และอนุญาตให้ใช้การ์ดพื้นสีดำเข้ม `#171717` (`surface-dark`) ได้ไม่เกิน **1 จุดต่อหน้า** เท่านั้น
2. **Shape Language:**
   - ทุกองค์ประกอบที่คลิกหรือกรอกข้อมูลได้ (Buttons, Inputs, Selects, Search Pills, Filter Chips, Command Tags) ต้องใช้มุมโค้งแคปซูล `9999px` (`rounded-full`)
   - การ์ดข้อมูล, ตาราง และกล่อง Terminal ใช้มุมโค้ง `12px` (`rounded-lg`) ขอบ `1px solid #e5e5e5` และห้ามซ้อนการ์ดมีขอบไว้ในการ์ดมีขอบอีกชั้น (No Nested Bordered Cards)
3. **Typography:** หัวข้อใหญ่ใช้ `SF Pro Rounded`, เนื้อหาและป้ายกำกับใช้ `ui-sans-serif`, และรหัสเอกสาร/ตัวเลขเงิน/มิเตอร์/เวลาถอยหลังใช้ `ui-monospace` (`tabular-nums`)
4. **Central UI Components Only:** ห้ามใช้ `<input>`, `<select>`, `<button>` ดิบในหน้าฟีเจอร์ ต้องเรียกผ่าน `frontend/src/components/ui/` และใช้ `FormTabs` (แสดงจุดแดงเมื่อแท็บมี Error) กับ `useDeferredFileUpload` (อัปโหลดไฟล์เฉพาะตอนกด Submit ฟอร์ม) เสมอ

---

## 5. กฎเหล็กด้านข้อมูล, API และความปลอดภัย (Data, API & Security Rules)

1. **No Frontend `.find()` Foreign Key Resolution:**
   API สำหรับแสดงตารางหรือรายละเอียดต้องส่งข้อมูลที่จำเป็นในการแสดงผลมาเป็นอ็อบเจกต์ย่อยพร้อมใช้ (เช่น `unit: { id, unitNumber, buildingName }`, `customer: { id, fullName, maskedNationalId }`) ห้ามส่งเฉพาะ `unitId` หรือ `customerId` แล้วให้ Frontend ดึง Master List ทั้งหมดมา `.find()` เอง
2. **RFC 9457 Problem Details Everywhere:**
   ทุก Error จาก Backend ต้องตอบกลับตามมาตรฐาน RFC 9457 พร้อมฟิลด์ `errorCode` เสถียร (เช่น `unit.not_clean`, `reservation.slot_overlap`, `reservation.hold_expired`, `shift.not_open`, `meter.rollover_unconfirmed`) เพื่อให้ Frontend แปลข้อความผ่านระบบ `i18n` ได้อย่างแม่นยำ
3. **Zero Double-Booking & Hold TTL:**
   การตรวจสอบและจองห้องพักทุกโหมดต้องผ่านกลไกล็อกระดับฐานข้อมูล (`tstzrange` + `EXCLUDE USING gist` สำหรับการระบุ `Unit` และ Row Lock บน `UnitType` สำหรับการจองแบบโควตา) พร้อมจัดการสถานะ `Hold` ที่มี `HoldExpiresAt`
4. **PDPA & Financial Integrity:**
   - เลขบัตรประชาชนและหนังสือเดินทางต้องแสดงผลแบบ Masking (`1-xxxx-xxxxx-12-3`) เป็นค่าเริ่มต้น และห้ามหลุดลง Log เด็ดขาด
   - ห้ามลบใบแจ้งหนี้ (`Invoice`) หรือใบเสร็จ (`Receipt`) ที่ออกแล้ว และทุกรายการรับ/จ่ายเงินสดหน้าเคาน์เตอร์ต้องผูกกับ `CashierShift` สถานะ `Open`

---

## 6. การตรวจสอบความถูกต้องก่อนส่งมอบงาน (Verification Gates)

ก่อนถือว่างานเอกสารหรืองานโค้ดเสร็จสมบูรณ์ ต้องรันคำสั่งตรวจสอบและยืนยันผลลัพธ์จาก Terminal จริงทุกครั้ง:

```bash
# ตรวจสอบความครบถ้วนของเอกสารธรรมาภิบาล คำศัพท์ รหัสเอกสาร และลิงก์ภายในทั้งหมด
npm run verify:docs
```
