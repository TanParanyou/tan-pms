# ADR-0004: Localized `jsonb` (`{ "th": string, "en"?: string }`) for Master Data & Billing Snapshot Text

## Status

Accepted — 2026-11-06

## Context

ระบบ `tan-pms` รองรับผู้ใช้งาน 2 ภาษา (`th` เป็นค่าเริ่มต้น และ `en` สำหรับลูกค้าต่างชาติและผู้บริหาร) ข้อมูลหลักของอาคารและห้องพัก (`Property`, `Building`, `Floor`, `UnitType`, `UnitAsset`, `HourlyRateRule`) รวมถึงข้อความ Snapshot ในใบแจ้งหนี้และใบเสร็จ (`FolioCharge.Description`, `InvoiceLine.Description`) ต้องสามารถแสดงผลและค้นหาได้ทั้งภาษาไทยและภาษาอังกฤษโดยไม่ต้องเพิ่มคอลัมน์แยกต่อภาษา (`name_th`, `name_en`) ทุกครั้งที่ขยายโมดูล และต้องสอดคล้องกับมาตรฐานของ `tan-erp` (`ADR-0012`)

## Decision

1. **ใช้ Value Object กลาง `LocalizedText` ใน Domain Layer (`TanPms.Domain/Common/LocalizedText.cs`):**
   - โครงสร้างคงที่ `{ "th": string, "en"?: string }` (`[JsonPropertyName("th")] public string Thai`, `[JsonPropertyName("en")] public string? English`)
   - บังคับ Validation ที่ Domain ว่า `Thai` (`th`) ห้ามว่าง (`localized_text.thai_required`) และจำกัดความยาวสูงสุด (`maxLength`)
   - มีเมธอด `Resolve(string? locale)` ที่คืนค่า `English` เมื่อ `locale` เป็น `"en"` และมีข้อมูล มิฉะนั้นจะ Fallback คืนค่า `Thai` เสมอ
2. **เก็บลง PostgreSQL ด้วยชนิดคอลัมน์ `jsonb` ผ่าน EF Core `ValueConverter`:**
   - ใช้กับ `Property` (`Name`, `Address`), `Building` (`Name`), `Floor` (`Name`), `UnitType` (`Name`, `Description`), `UnitAsset` (`Name`), `HourlyRateRule` (`Name`), `FolioCharge` (`Description`) และ `InvoiceLine` (`Description`)
   - สร้าง Expression Index บน `(name->>'th')` และ `(name->>'en')` สำหรับตาราง Master Data ที่มีการค้นหาด้วยชื่อ
3. **คงฟิลด์คำนวณและเอกลักษณ์ทางธุรกิจเป็น Relational Typed Columns ปกติ:**
   - รหัสอ้างอิง (`Code`, `UnitNumber`, `DocumentNumber`), สถานะ (`StayMode`, `OccupancyStatus`, `ConditionStatus`, `TaxMode`), ตัวเลขเงิน/มิเตอร์/เวลา และชื่อบุคคลตามเอกสารราชการ (`Customer.FullName`, `Occupant.FullName`) ยังคงเป็น Relational Typed Columns ปกติ ห้ามยุบรวมทั้ง Entity เป็น JSONB ก้อนเดียว

## Consequences

- **ข้อดี:** โครงสร้างข้อมูลหลายภาษาเป็นมาตรฐานเดียวกันทั้งระบบ (`backend/`, `contracts/openapi/tan-pms.v1.json`, `frontend/`), ลด Schema Migration เมื่อจัดการฟิลด์ข้อความหลายภาษา และทำให้ Frontend แสดงผลผ่าน `resolveLocalizedText(value, locale)` ได้ทันทีโดยไม่ต้อง Hardcode
- **ข้อควรระวัง:** ต้องผ่าน `LocalizedText.Create(...)` เสมอเพื่อรับประกันว่าคีย์ `th` ไม่ว่าง และใช้ Expression Index เมื่อต้องค้นหาข้อความภายใน `jsonb`
