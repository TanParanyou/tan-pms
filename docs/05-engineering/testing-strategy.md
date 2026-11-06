# Testing Strategy & Quality Pyramid — `tan-pms`

เอกสารนี้กำหนดกลยุทธ์การเขียนชุดทดสอบอัตโนมัติ (Automated Testing) สำหรับทั้งฝั่ง Backend (`.NET 10`) และ Frontend (`Next.js`) ของ **`tan-pms`**

> อ้างอิงเกณฑ์ส่งมอบงานจาก [definition-of-done.md](./definition-of-done.md) และธรรมนูญโปรเจกต์จาก [AGENTS.md](../../AGENTS.md)

---

## 1. พีระมิดการทดสอบ 4 ระดับ (Testing Pyramid)

| ระดับการทดสอบ | โปรเจกต์ / เครื่องมือ | สิ่งที่ต้องทดสอบ |
|---|---|---|
| **1. Architecture Tests** | `TanPms.ArchitectureTests` (`ArchUnitNET`) | ยืนยันว่า `Domain` ไม่อ้างอิง `EF Core`/`Dapper`, ทุก Endpoint มีการระบุ `AdminScope` หรือ `ClientScope`, และไม่มีการใช้ชนิดข้อมูลเงินที่เป็น `float`/`double` |
| **2. Domain & Application Unit Tests** | `TanPms.UnitTests` (`xUnit` + `FluentAssertions`) | สูตรคำนวณราคารายชั่วโมง (`GracePeriodMinutes`, `AutoCapToDailyRate`), สูตรมิเตอร์น้ำ-ไฟ (`MeterRollover`), สูตรภาษีรายบรรทัด (`Exempt`, `VatIncluded`, `VatExcluded`, `WithholdingTax`), และกฎ State Machine ทั้ง 7 เอนทิตี |
| **3. Database & API Integration Tests** | `TanPms.IntegrationTests` (`Testcontainers.PostgreSql` + `WebApplicationFactory`) | ทดสอบกับ PostgreSQL จริง: `EXCLUDE USING gist` บน `tstzrange` ป้องกันจองซ้อน, การหมดอายุของ `Hold TTL`, การรันเลขเอกสาร Atomic 100 รายการพร้อมกัน, และการกั้นข้อมูลข้าม `PropertyId` / `CustomerId` |
| **4. Frontend Component & E2E Tests** | `Vitest` + `Testing Library` + `Playwright` | ทดสอบ `FormTabs` แสดงจุดแดงเมื่อมี Error, `useDeferredFileUpload` ไม่ยิงอัปโหลดก่อนกด Submit, ตารางจดมิเตอร์แบบ Zero-Layout-Shift, และ Flow จองออนไลน์จาก `(client)` ไปจนถึง `(admin)` อนุมัติสลิป |

---

## 2. กฎเหล็กในการเขียนชุดทดสอบ (Testing Rules)

1. **No In-Memory Database for Integration Tests:**
   ห้ามใช้ `EF Core InMemory` ในการทดสอบ `AvailabilityEngine` หรือ `DocumentNumberService` เพราะไม่สามารถจำลอง `tstzrange` + `EXCLUDE USING gist` และ `INSERT ... ON CONFLICT DO UPDATE RETURNING` ของ PostgreSQL ได้ ต้องใช้ `Testcontainers.PostgreSql` เสมอ
2. **Mandatory Security & Scope Isolation Tests:**
   ทุก Vertical Slice (`PM-01` ถึง `PM-10`) ต้องมี Integration Test อย่างน้อย 1 ข้อที่พิสูจน์ว่า:
   - พนักงานสาขา A ไม่สามารถอ่านหรือแก้ไขข้อมูลของสาขา B ได้ (`403`/`404`)
   - ลูกค้าในฝั่ง `client` บัญชี A ไม่สามารถอ่านหรือแนบสลิปของลูกค้าบัญชี B ได้
3. **i18n Key Parity Test:**
   ต้องมีสคริปต์ตรวจสอบว่าทุกคีย์ใน `frontend/src/messages/th.json` มีอยู่ใน `frontend/src/messages/en.json` ครบ 100%
