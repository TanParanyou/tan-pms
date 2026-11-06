# Observability, Structured Logging & Health Checks — `tan-pms`

เอกสารนี้กำหนดมาตรฐานการติดตามการทำงานของระบบ (`Structured Logging`, `OpenTelemetry Tracing`) และการตรวจสอบสุขภาพของระบบ (`Health Probes`) สำหรับ **`tan-pms`**

> อ้างอิงกฎการปกปิดข้อมูลส่วนบุคคลใน Log จาก [pdpa-and-audit-redaction.md](../04-data/pdpa-and-audit-redaction.md)

---

## 1. มาตรฐานการบันทึก Log แบบมีโครงสร้าง (`Structured Logging`)

ทุกบรรทัดของ Log ใน `TanPms.WebApi` และ Background Worker ต้องส่งออกเป็น JSON (ผ่าน `Serilog`) พร้อมฟิลด์บริบทมาตรฐาน:
- `timestamp` (ISO 8601 UTC)
- `level` (`Information`, `Warning`, `Error`, `Fatal`)
- `traceId` และ `spanId` (ตรงกับค่า `traceId` ที่ส่งกลับใน RFC 9457 Problem Details)
- `userId`, `scope` (`AdminScope` | `ClientScope`), และ `propertyId` (ถ้ามี)
- **การกรองข้อมูลอ่อนไหว:** บังคับใช้ `RedactingEnricher` เพื่อซ่อนเลขบัตรประชาชน รหัสผ่าน และ Token เป็น `[REDACTED]` เสมอ

---

## 2. การตรวจสอบสุขภาพของระบบ (`Health Check Endpoints`)

ระบบเปิด Endpoint มาตรฐานสำหรับ Container Orchestrator / Load Balancer:

| Endpoint | ประเภท | สิ่งที่ตรวจสอบ |
|---|---|---|
| `GET /health/live` | Liveness Probe | ตรวจว่าโปรเซส `TanPms.WebApi` ยังตอบสนองอยู่ (ไม่เช็ก Dependency ภายนอกเพื่อป้องกันการรีสตาร์ตวนลูป) |
| `GET /health/ready` | Readiness Probe | ตรวจการเชื่อมต่อ `PostgreSQL` (`SELECT 1`), การเข้าถึง `IFileStorage` และการเปิดใช้งาน Extension `btree_gist` |

---

## 3. ตัวชี้วัดสำคัญที่ต้องเฝ้าระวัง (Key Operational Metrics)

1. **`tan_pms.reservations.hold_expired_total`:** จำนวนใบจองสถานะ `Hold` ที่หมดเวลา `HoldExpiresAt` (ใช้ติดตามว่าลูกค้าติดขัดขั้นตอนโอนเงินหรือแนบสลิปหรือไม่)
2. **`tan_pms.availability.overlap_rejected_total`:** จำนวนครั้งที่ฐานข้อมูลหรือ Availability Engine ปฏิเสธการจองซ้อน (`reservation.slot_overlap`)
3. **`tan_pms.cashier.variance_amount`:** ยอดผลต่างเงินสด (`CashVariance`) เมื่อปิดกะแคชเชียร์แยกตาม `Property`
4. **`tan_pms.billing.batch_duration_ms`:** เวลาที่ใช้ในการประมวลผล `Batch Invoice Run` รายเดือนต่ออาคาร
