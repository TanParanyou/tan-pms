---
name: building-pms-forms
description: คู่มือและมาตรฐานการสร้างหรือแก้ไขหน้าฟอร์ม PMS (Create/Edit/View Forms) สำหรับโปรเจกต์ tan-pms ครอบคลุม Single Dynamic Route [id], Feature Colocation, React Hook Form Controller, TanStack Query, Zod validation, useDeferredFileUpload, FormTabs & useFormTabErrors, ConfirmationModal, Strict Input Height Harmony, Top-Right Field Actions, Icon-First Adjacent Buttons, Zero-Layout-Shift Cells และ Ollama Minimal Design System + shadcn/ui
---

# Building PMS Forms (`tan-pms` Frontend Standards)

## 1. File Structure & Feature Colocation (`src/features/<feature>/`)
ห้ามเทรวมโค้ดฟอร์มไว้ใน `src/app/**/page.tsx` ต้องจัดโครงสร้างตาม Business Feature:
- `src/app/(admin)/admin/<feature>/[id]/page.tsx` (Thin Route Entry รองรับ `id="create"` / `"add"` และ `id` จริง)
- `src/features/<feature>/`:
  - `api/`: TanStack Query hooks & query keys
  - `components/`: `<Feature>Editor.tsx`, `<Feature>FormFields.tsx`, `<Feature>Modal.tsx`
  - `schemas/`: Zod validation schemas
  - `types/`: Feature types ที่ต่อยอดจาก `@/generated/api/tan-pms.v1`

## 2. Ollama Minimal Design System & `shadcn/ui` Controls
- **Zero Raw HTML Controls:** ห้ามใช้ `<input>`, `<select>`, `<textarea>`, `<button>` ดิบในหน้าฟีเจอร์ ให้ import แบบ Direct Sub-path จาก `@/components/ui/button`, `@/components/ui/input`, `@/components/ui/label`, `@/components/ui/select-pill`, `@/components/ui/form-tabs`, `@/components/ui/deferred-file-picker`, `@/components/ui/confirmation-modal`, `@/components/ui/tooltip`, `@/components/ui/alert`
- **Pill Geometry (`9999px`) & Hairline Cards (`12px`):**
  - ทุกปุ่ม ช่องกรอก ตัวเลือก ใช้ `rounded-full` (`9999px`) ความสูงสม่ำเสมอตาม `--pms-control-h` (`h-10 min-h-[40px]` หรือ `h-11 min-h-[44px]`)
  - การ์ดและส่วนฟอร์ม (`<FormSection />`) ใช้ `rounded-[12px]` `border-[#e5e5e5]` `bg-[#ffffff]` `shadow-none` (ห้ามซ้อนการ์ดมีขอบไว้ในการ์ดมีขอบอีกชั้น)
- **Mandatory Localized Placeholders:** ทุก `<Input>` และ `<Textarea>` ต้องมี `placeholder` ที่ดึงจาก `messages/th.json` และ `messages/en.json`

## 3. Tabbed Form Architecture (`FormTabs` & `useFormTabErrors`)
1. **Red Dot Error Indicator (`#ff5f56`):** แสดงจุดสีแดงบนหัวแท็บที่มีฟิลด์ไม่ผ่านการตรวจสอบทันที
2. **Auto-Switch on Submit Error:** สลับไปยังแท็บแรกที่มีข้อผิดพลาดอัตโนมัติผ่าน `handleSubmit(onSubmit, handleFormError)`
3. **Unrestricted Tab Switching:** คลิกสลับแท็บได้อย่างอิสระ (No Forced Wizard)
4. **DOM Preservation:** ใช้ `className={cn(activeTab !== "tabId" && "hidden")}` แทนการ Unmount DOM เพื่อรักษาการลงทะเบียนฟิลด์ของ React Hook Form

## 4. Field Layout & Zero-Layout-Shift Rules
1. **Top-Right Field Actions:** ปุ่มเสริมประจำฟิลด์ต้องวางในแถวเดียวกับ `<Label>` (`flex items-center justify-between min-h-[20px] mb-1.5`) ห้ามห้อยใต้ช่องกรอก
2. **Icon-First Adjacent Buttons:** ปุ่มขนาบข้างช่องกรอกต้องใช้ `size="icon"` `rounded-full` ครอบด้วย `<Tooltip content="..." />` พร้อม `aria-label` และใช้ `wrapperClassName="!mb-0"` บนช่องกรอกใน `flex items-center gap-2`
3. **Zero-Layout-Shift Live Calculation Cells:** ในตารางคำนวณสด (เช่น ตารางจดมิเตอร์น้ำ-ไฟ `Usage = Current - Previous`) ต้องล็อกความสูงข้อความย่อยด้วย `mt-1 min-h-[16px]` และใส่ `<span className="invisible select-none" aria-hidden="true">-</span>` ในคอลัมน์ข้างเคียงเพื่อป้องกันแถวกระตุก
4. **Deferred File Upload (`useDeferredFileUpload`):** เก็บไฟล์ไว้ในหน่วยความจำและอัปโหลดจริงเฉพาะใน `onSubmit` เท่านั้น
5. **Safety Confirmation Modal (`ConfirmationModal`):** การลบ การ `Void` บิล การคืนเงินประกัน หรือการ Override ห้อง `Dirty` ต้องยืนยันผ่าน `ConfirmationModal` ที่มี `isLoading` ล็อกปุ่มเสมอ

## 5. Zero Hardcode, Zero Thai Characters in `.tsx` & Localized Inputs
- **Zero Thai in `.tsx`:** ห้ามมีตัวอักษรภาษาไทย (`[\u0E00-\u0E7F]`) หรือข้อความ UI Hardcode ใน JSX Props (`label`, `placeholder`, `helperText`, `title`) ทุกข้อความต้องดึงผ่าน `useTranslations()` จาก `messages/th.json` และ `messages/en.json`
- **Constants Isolation:** ตัวเลือกคงที่หรือข้อมูลเริ่มต้นต้องแยกไว้ใน `src/features/<feature>/constants.ts` เสมอ ห้ามวาง Array ไว้ใน JSX
- **Localized Master Data Inputs:** สำหรับฟอร์มบันทึก Master Data ที่ใช้ `LocalizedText` (`jsonb` `{ th, en }`) ให้จัดเตรียมช่องกรอกคู่ (`name.th` จำเป็นต้องกรอก / `name.en` ไม่บังคับกรอก) พร้อมระบุ Label และ Placeholder แยกตามภาษา
