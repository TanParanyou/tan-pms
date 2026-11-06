# Database Standards, `tstzrange` Exclusion & Atomic Numbering — `tan-pms`

เอกสารนี้กำหนดมาตรฐานการออกแบบฐานข้อมูล `PostgreSQL`, กลไกป้องกันการจองห้องซ้อนระดับฐานข้อมูล และการรันเลขที่เอกสารแบบ Atomic ของ **`tan-pms`**

> อ้างอิงการตัดสินใจจาก [0002-hybrid-availability-and-ttl-hold.md](../adr/0002-hybrid-availability-and-ttl-hold.md)

---

## 1. มาตรฐานตารางและคอลัมน์พื้นฐาน (`PostgreSQL Conventions`)

1. **Naming & Primary Keys:**
   - ชื่อตารางและคอลัมน์ใน PostgreSQL ใช้ `snake_case` ทั้งหมด
   - Primary Key ทุกตารางใช้ `uuid` แบบ **UUIDv7** (`Guid.CreateVersion7()` ใน .NET 10) เพื่อให้เรียงตามเวลาและลด Index Fragmentation
2. **Data Types มาตรฐาน:**
   - จำนวนเงินทุกฟิลด์ใช้ `numeric(18,2)` ห้ามใช้ `float` หรือ `double precision`
   - วันและเวลาทุกฟิลด์ใช้ `timestamptz` (UTC) และช่วงเวลาใช้ `tstzrange`
   - ชื่อและคำอธิบายหลายภาษาของ Master Data (`Property`, `Building`, `Floor`, `UnitType`, `UnitAsset`, `HourlyRateRule`) และ Snapshot รายการบิล (`FolioCharge.Description`, `InvoiceLine.Description`) ใช้คอลัมน์ `jsonb` รูปทรงคงที่ `{ "th": string, "en"?: string }` ผ่าน Value Object `LocalizedText` และ EF Core `ValueConverter` ตาม [0004-localized-jsonb-for-master-data-text.md](../adr/0004-localized-jsonb-for-master-data-text.md)
3. **Audit & Soft Delete Columns:**
   - ทุกตารางหลักมี `created_at`, `created_by`, `updated_at`, `updated_by`, `is_deleted`, `deleted_at`, `deleted_by`

---

## 2. การป้องกันการจองซ้อนด้วย `tstzrange` + `EXCLUDE USING gist`

เพื่อรับประกัน **Zero Double-Booking** ข้ามทั้ง 3 โหมด (`Hourly`, `Daily`, `Monthly`), ระบบเปิดใช้งาน Extension `btree_gist` และสร้าง Constraint ป้องกันช่วงเวลาทับซ้อนบนตารางสล็อตการครองห้อง (`unit_availability_slots`):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE unit_availability_slots (
    id uuid PRIMARY KEY,
    property_id uuid NOT NULL,
    unit_id uuid NOT NULL REFERENCES units(id),
    source_type varchar(32) NOT NULL, -- 'Reservation', 'Stay', 'Lease', 'MaintenanceBlock'
    source_id uuid NOT NULL,
    stay_mode varchar(16) NOT NULL,   -- 'Hourly', 'Daily', 'Monthly'
    occupied_period tstzrange NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT excl_unit_occupied_period_no_overlap
        EXCLUDE USING gist (
            unit_id WITH =,
            occupied_period WITH &&
        ) WHERE (is_active = true)
);
```

- สำหรับโหมด `Hourly`: ช่วง `occupied_period` จะรวมเวลาเข้าพักจริงบวกด้วย `TurnaroundBufferMinutes` (เช่น เข้าพัก 13:00–16:00 บวกเวลาแม่บ้าน 30 นาที จะล็อก `['2026-11-06 06:00:00+00', '2026-11-06 09:30:00+00')`)
- สำหรับการจองแบบโควตา `UnitType` (ยังไม่ระบุ `unit_id`): ระบบใช้ `SELECT id FROM unit_types WHERE id = @UnitTypeId FOR UPDATE` เพื่อล็อกแถว `UnitType` ขณะคำนวณจำนวนห้องว่างสุทธิและตัดโควตา `Hold`

---

## 3. การรันเลขที่เอกสารแบบ Atomic (`DocumentSequence`)

รหัสเอกสารทั้ง 9 หมวด (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`) ใช้ตาราง `DocumentSequence` (`document_sequences`) ร่วมกับคำสั่ง Upsert แบบ Atomic ใน PostgreSQL:

```sql
INSERT INTO document_sequences (property_id, document_type, period_yymm, last_sequence, updated_at)
VALUES (@PropertyId, @DocumentType, @PeriodYyMm, 1, NOW())
ON CONFLICT (property_id, document_type, period_yymm)
DO UPDATE SET
    last_sequence = document_sequences.last_sequence + 1,
    updated_at = NOW()
RETURNING last_sequence;
```

ผลลัพธ์นำมาจัดรูปแบบเป็น `{PROP}-{DOC}-{YY}{MM}-{SEQ:4}` (เช่น `BKK01-INV-2611-0042`) โดยรับประกันว่าไม่มีเลขซ้ำแม้มีผู้ใช้งานกดสร้างเอกสารพร้อมกันหลายสิบรายการ
