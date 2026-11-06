---
name: pms-document-numbering
description: คู่มือและมาตรฐานสถาปัตยกรรมระบบรันเลขที่เอกสาร 9 หมวดและรหัสข้อมูลหลัก (Document Numbering & Master Data Sequences) สำหรับโปรเจกต์ tan-pms ครอบคลุม PostgreSQL Atomic Upsert (Zero Collision), รูปแบบ {PROP}-{DOC}-{YY}{MM}-{SEQ:4} สำหรับ RES, STY, LSE, INV, RCT, DEP, SHF, WKO, PCL และ Master Data Codes
---

# PMS Document Numbering & Sequence Architecture (`tan-pms`)

## 1. Transactional Documents (9 Canonical Prefixes) vs Master Data Codes

| หมวดหมู่ | รหัส (`{DOC}` / `{PREFIX}`) | รูปแบบมาตรฐาน | รอบการรีเซ็ต (`ResetPeriod`) |
|---|---|---|---|
| **Transactional Documents (9 หมวด)** | `RES` (`Reservation`), `STY` (`Stay`), `LSE` (`Lease`), `INV` (`Invoice`), `RCT` (`Receipt`), `DEP` (`DepositTransaction`), `SHF` (`CashierShift`), `WKO` (`WorkOrder`), `PCL` (`Parcel`) | `{PROP}-{DOC}-{YY}{MM}-{SEQ:4}` (เช่น `BKK01-INV-2611-0042`) | `Monthly` ต่อ `Property` |
| **Master Data Codes** | `CUS-` (`Customer`), `AST-` (`UnitAsset`) | `{PREFIX}{SEQ:5}` (เช่น `CUS-00001`) | `Never` (ต่อเนื่องตลอดอายุระบบ) |

## 2. PostgreSQL Atomic Upsert Guarantee (Zero Collision)
ห้ามใช้ `SELECT MAX(...) + 1` ในโค้ด Application เด็ดขาด ต้องใช้คำสั่ง Atomic Upsert บนตาราง `document_sequences`:

```sql
INSERT INTO document_sequences (property_id, document_type, period_yymm, last_sequence, updated_at)
VALUES (@PropertyId, @DocumentType, @PeriodYyMm, 1, clock_timestamp())
ON CONFLICT (property_id, document_type, period_yymm)
DO UPDATE SET
    last_sequence = document_sequences.last_sequence + 1,
    updated_at = clock_timestamp()
RETURNING last_sequence;
```
