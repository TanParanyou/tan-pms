# Development-Ready Gate (20-Point Verification Checklist) — `tan-pms`

เอกสารนี้คือรายการตรวจสอบความพร้อม **20 ข้อ (ตามมาตรฐาน `scaffold-enterprise-core`)** ที่ต้องผ่านครบถ้วนก่อนถือว่าฐานรากของระบบ (`Phase 0`) และเอกสารธรรมาภิบาลพร้อมสำหรับการพัฒนาฟีเจอร์ระดับองค์กร

> อ้างอิงแผนการพัฒนาจาก [implementation-roadmap.md](../00-overview/implementation-roadmap.md)

---

## 1. หมวดธรรมาภิบาลและโครงสร้างเอกสาร (Governance & Documentation)
- [x] **1. Authoritative Root Files:** มี [AGENTS.md](../../AGENTS.md), [CONTEXT.md](../../CONTEXT.md), [design.md](../../design.md) (`DESIGN.md`) และ [PRODUCT.md](../../PRODUCT.md) ครบถ้วนที่ระดับ Root
- [x] **2. Ubiquitous Language Lock:** นิยามคำศัพท์หลักครบ 20 คำ พร้อมระบุคำต้องห้าม (`Staff`, `Portal`, `Branch`, `RoomType`, `Booking`, `Contract`) ใน [CONTEXT.md](../../CONTEXT.md)
- [x] **3. Document Numbering Specification:** กำหนดรหัสเอกสารครบทั้ง 9 หมวด (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`) ในรูปแบบ `{PROP}-{DOC}-{YY}{MM}-{SEQ:4}`
- [x] **4. Complete Documentation Tree:** มีเอกสารครบทั้ง 7 หมวด (`00-overview` ถึง `06-operations`) และ `docs/adr/` โดยไม่มีไฟล์กำพร้า (Orphan Docs) และตรวจสอบผ่าน `npm run verify:docs`

## 2. หมวดสถาปัตยกรรมและความปลอดภัย (Architecture & Security)
- [x] **5. Clean Architecture Boundaries:** แยกชั้น `Domain`, `Application`, `Infrastructure`, `WebApi` ชัดเจนตาม [backend-architecture.md](../02-architecture/backend-architecture.md)
- [x] **6. Dual-Audience Separation (`admin` vs `client`):** แยก Route Group `(admin)` / `(client)` และ API Prefix `/api/v1/admin` / `/api/v1/client`
- [x] **7. Dual-Scope RBAC (`AdminScope` & `ClientScope`):** นิยามการกรอง `AllowedPropertyIds` สำหรับพนักงาน และการกรอง `CustomerId` สำหรับลูกค้า/ผู้เช่าใน [rbac-and-scopes.md](../03-contracts/rbac-and-scopes.md)
- [x] **8. Permission Catalog:** นิยามรหัสสิทธิ์ครบทั้ง 10 โมดูล พร้อมระบุรายการความเสี่ยงสูงใน [permission-catalog.md](../03-contracts/permission-catalog.md)
- [x] **9. PDPA & PII Masking:** กำหนดการเข้ารหัสและแสดงผลเลขบัตรประชาชนแบบ Masking (`1-xxxx-xxxxx-12-3`) และสิทธิ์ `admin.customer.unmask_pii` ใน [pdpa-and-audit-redaction.md](../04-data/pdpa-and-audit-redaction.md)
- [x] **10. Private File Storage & Deferred Upload:** กำหนดการใช้ `IFileStorage` แบบ Private ร่วมกับ `useDeferredFileUpload`

## 3. หมวดความถูกต้องของข้อมูลและการเงิน (Data & Financial Integrity)
- [x] **11. Zero Double-Booking Engine:** กำหนดการใช้ `tstzrange` + `EXCLUDE USING gist` ใน [database-and-locking-standards.md](../04-data/database-and-locking-standards.md)
- [x] **12. Hybrid Quota & Booking Hold TTL:** กำหนดกลไก `UnitType` Quota และ `HoldExpiresAt` (15 นาที) ใน [0002-hybrid-availability-and-ttl-hold.md](../adr/0002-hybrid-availability-and-ttl-hold.md)
- [x] **13. Hourly, Meter & Line-Level Thai Tax Formulas:** กำหนดสูตรคำนวณรายชั่วโมง มิเตอร์หมุนครบรอบ และภาษีรายบรรทัด (`Exempt`, `VatIncluded`, `VatExcluded`, `WithholdingTax`) ใน [pricing-meter-and-tax-rules.md](../01-business/pricing-meter-and-tax-rules.md)
- [x] **14. Cashier Shift & Deposit Ledger Isolation:** กำหนดสมการกระทบยอดกะแคชเชียร์ (`CashierShift`) และการแยกบัญชีเงินประกัน (`DepositLedger`) ออกจากรายได้
- [x] **15. Audit Trail & Soft Delete:** กำหนด `AuditableEntityInterceptor` และตาราง `AuditEvent` สำหรับรายการความเสี่ยงสูง

## 4. หมวดสัญญา API, UI/UX และปฏิบัติการ (Contracts, UI & Operations)
- [x] **16. RFC 9457 Problem Details Contract:** กำหนดโครงสร้างข้อผิดพลาดและรหัส `errorCode` มาตรฐานใน [error-contract.md](../03-contracts/error-contract.md)
- [x] **17. Structured Projection (No FE `.find()`):** กำหนดมาตรฐานการส่งข้อมูลอ้างอิงใน [api-conventions.md](../03-contracts/api-conventions.md)
- [x] **18. Ollama Minimal Design System & `shadcn/ui`:** กำหนดโทเค็น `#000000`, `#ffffff`, `#171717`, `9999px` pills, `12px` cards, `SF Pro Rounded` และ `FormTabs` ใน [design.md](../../design.md)
- [x] **19. Bilingual Localization (`th` / `en`):** กำหนดโครงสร้าง `messages/th.json` และ `messages/en.json`
- [x] **20. Observability, Health & Backup Baseline:** กำหนดมาตรฐานการตั้งค่าสภาพแวดล้อม สุขภาพระบบ และการสำรองข้อมูลในหมวด `06-operations`
