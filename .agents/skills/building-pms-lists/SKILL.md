---
name: building-pms-lists
description: คู่มือและมาตรฐานการสร้างหน้าตารางรายการ PMS (List/Table Pages & Unified Room Rack) สำหรับโปรเจกต์ tan-pms ครอบคลุม PageHeader, ListToolbar, Table-Preserved DataTable, Table Cell Flow Integrity (No sr-only on th/td), Structured Projections (No FE .find()), Safety Confirmation Modal และ Ollama Minimal Design System + shadcn/ui
---

# Building PMS Lists (`tan-pms` Table & Rack Standards)

## 1. 5-Layer List Architecture
1. **`PageHeader`:** Eyebrow tag, ชื่อหน้า (`SF Pro Rounded`), จำนวนรายการ และปุ่ม Primary CTA (`rounded-full` `#000000`)
2. **`ListToolbar`:** ช่องค้นหาทรงแคปซูล (`rounded-full`), ตัวกรอง (`StayMode`: `Hourly`/`Daily`/`Monthly`, `Building`, `Floor`, `Status`) และปุ่มส่งออกข้อมูล
3. **Table-Preserved Main Content (`DataTable`):**
   - **ห้ามสลับ `<DataTable />` ออกเมื่อเกิด Error หรือค้นหาไม่พบข้อมูล** (`{isError ? <Error /> : <DataTable />}` เป็นสิ่งต้องห้าม)
   - ต้องคง `<DataTable />` และ `<thead>` ไว้บนหน้าจอเสมอ แล้วแสดงสถานะ Loading / Error Banner / Empty Filter ภายใน `<tbody>`
   - เฉพาะกรณีที่ยังไม่มีข้อมูลในระบบเลยตั้งแต่เริ่มต้น (`isZeroEntities === true` โดยไม่มีการค้นหาหรือกรอง) จึงแสดง `<EmptyState />`
4. **`BulkActionToolbar`:** แถบคำสั่งลอยด้านล่างเมื่อมีการเลือกหลายแถว
5. **Action Overlays (Official shadcn `AlertDialog` / `ConfirmationModal` & `Sheet` Drawer):** ยืนยันก่อนทำรายการสำคัญผ่าน `AlertDialog` พร้อมล็อกปุ่ม `isLoading` และใช้ `<Sheet>` สำหรับ Drawer ดูรายละเอียดเพิ่มเติม ห้ามเขียน Modal Overlay ขึ้นมาเอง

## 2. Table Cell Flow Integrity (Zero Table Shifting)
- **ห้ามใส่คลาส `sr-only` ลงบนแท็ก `<th>`, `<td>`, `<TableHead>` หรือ `<TableCell>` โดยเด็ดขาด** เพราะ `position: absolute` จะทำให้คอลัมน์ของ `<thead>` และ `<tbody>` เยื้องกัน
- หากต้องการซ่อนข้อความหัวคอลัมน์สำหรับ Screen Reader ให้ใส่ `<span className="sr-only">{t("actions")}</span>` **ไว้ข้างใน** `<TableHead>` เสมอ

## 3. Structured Projections & No Arbitrary Fallback
- แสดงผลข้อมูลความสัมพันธ์จาก Nested Object ที่ Backend ส่งมาโดยตรง (`row.unit.unitNumber`, `row.unit.buildingName`, `row.customer.fullName`, `row.customer.maskedNationalId`) ห้ามใช้ `array.find()` บน Frontend
- หากฟิลด์ใดไม่มีค่า (`null` / `undefined`) ให้แสดง `-` ตามมาตรฐาน ห้ามเขียน Fallback ลูกโซ่คาดเดาฟิลด์อื่น (`valA || valB || valC`)

## 4. Localized Text Columns & Zero Thai in `.tsx`
- **`resolveLocalizedText(value, locale)`:** สำหรับคอลัมน์ที่แสดงชื่อหรือคำอธิบาย Master Data จาก API (`LocalizedTextDto` `{ th, en }`) เช่น `buildingName`, `unitTypeName` ให้เรียกผ่าน Helper `resolveLocalizedText(col, locale)` เสมอ
- **Zero Thai in `.tsx`:** หัวตาราง (`header`), ป้ายสถานะ (`Badge`), ข้อความว่าง (`emptyTitle`, `emptyDescription`) ต้องดึงผ่าน `useTranslations()` ทั้งหมด 100% ห้ามมีตัวอักษรภาษาไทยหลุดในไฟล์ `.tsx`
