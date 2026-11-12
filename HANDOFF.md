# Handoff: tan-pms (ส่งต่อให้ Gemini Argon)

วันที่: 2026-11-12 · branch `main` · commit ล่าสุด `7c085f2` · ไม่มี git remote (ยังไม่เคย push)

## 0. กฎก่อนเริ่ม (บังคับ)
1. อ่าน [AGENTS.md](./AGENTS.md) และ [design.md](./design.md) ทุกครั้ง ตอบผู้ใช้เป็นภาษาไทย
2. ทำเฉพาะที่ถูกสั่ง ไม่แน่ใจให้ถาม ห้ามเดา ห้าม refactor นอกขอบเขต
3. ห้าม `any`/`as any`/`@ts-ignore`, ห้าม hardcode ข้อความ UI (i18n `th` และ `en` ครบคู่), ห้าม emoji, ห้าม raw HTML control, ใช้ shadcn/ui กลาง
4. ห้ามแก้ `frontend/src/generated/` ด้วยมือ (สร้างจาก `npm run generate:api` ตาม `contracts/openapi/tan-pms.v1.json`)
5. กฎโควตา: ผู้ใช้สั่งให้หยุดและสรุป handoff ก่อน Claude Weekly เกิน 30% (ใช้กับ Claude เท่านั้น)
6. ถามก่อน push เสมอ (และตอนนี้ push ไม่ได้เพราะไม่มี remote)

## 1. สถานะ
PM-01 ถึง PM-10 ทำครบและ commit แล้ว ทุกฟีเจอร์มี สร้าง/ดู/แก้/ลบหรือยกเลิก ครบ พร้อม: file storage, PDF (QuestPDF + Sarabun), ผูกเงินสดกับกะแคชเชียร์, due date + overdue sweeper, pagination, analytics, ระบบ login JWT ของระบบเอง (ADR-0011) และ hardening, ADR 0005 ถึง 0011

ผล Gate ล่าสุด (หลังปิดงานข้อ 1-3: ใช้ VatRatePercent จาก TaxProfile จริง, กำหนดสิทธิ์ admin.rack.view อย่างเป็นทางการ, ล็อก ChargeCategoryCode ของระบบ):
- backend: build ผ่าน 0 warning / 0 error, unit 120/120 ผ่าน, architecture 5/5 ผ่าน, integration 55/55 ผ่าน (Postgres จริง รวม `OpenApiContractTests`)
- frontend: `tsc --noEmit` ผ่าน, vitest 347/347 ผ่าน, `npm run build` ผ่าน
- `npm run verify:docs` ผ่าน (36 ไฟล์)

## 2. นโยบายที่ผู้ใช้ตัดสินแล้ว
- ลบจริงเฉพาะ Draft หรือไม่มีผลทางการเงิน อย่างอื่น Cancel/Void ต้องมีเหตุผล + audit + `ConfirmationModal`; กะที่ปิดแล้วและสลิปที่อนุมัติแล้วแก้ไม่ได้; ผู้ใช้ปิดใช้งานแทนการลบ ([ADR-0010](./docs/adr/0010-delete-cancel-void-policy.md))
- ค่าน้ำ-ไฟ: VAT รวมในราคา 7% แต่ต้องเปลี่ยนได้ (เปลี่ยน TaxMode และ VatRatePercent ได้แล้วผ่าน `POST .../properties/{pid}/rates/taxes` และมีผลคำนวณจริงใน Batch Invoices)
- สิทธิ์ตารางห้องว่าง: กำหนดคีย์ทางการ `admin.rack.view` ตรวจสอบใน `GetAdminRoomRackHandler` และกำหนดให้บทบาท OrganizationAdmin, PropertyManager, FrontDeskCashier
- ล็อกรหัสภาษีระบบ: ห้ามเปลี่ยน `ChargeCategoryCode` ของ `ProtectedTaxCodes` หรือโปรไฟล์ที่มีบิลอ้างอิงอยู่ ตอน `UpsertTaxProfile` ทั้งใน backend และ frontend
- เลื่อนไว้: ทดสอบบนเบราว์เซอร์/e2e ("ยังไม่ทำ"), ตัวส่ง LINE/Email ("ไม่รีบ"), ไม่มี ESLint (ยอมรับ), ไม่มี remote (ยอมรับ)

## 3. งานค้าง / ต้องให้ผู้ใช้ตัดสินใจ (ถามก่อนทำ)
1. **[เสร็จแล้ว] อัตรา VAT แก้ไม่ได้จริง:** เชื่อม `VatRatePercent` จาก `TaxProfile` เข้ากับ `Invoice.AddLine`/`BuildAutoLines` แล้ว รัน batch draft คำนวณตามอัตราของโปรไฟล์จริง
2. **[เสร็จแล้ว] เส้นทาง rack ไม่ต้องมี permission:** เพิ่ม `PermissionKeys.AdminRackView` (`admin.rack.view`) เข้า catalog 26 คีย์ทางการ และตรวจสิทธิ์ใน `GetAdminRoomRackHandler` แล้ว
3. **[เสร็จแล้ว] การ upsert โปรไฟล์ภาษีของระบบเปลี่ยน ChargeCategoryCode ได้:** ป้องกันใน `RateCatalogRules.CheckCategoryChangeAllowed` และปิดการแก้ไขใน UI ฝั่ง frontend แล้ว
4. **[เสร็จแล้ว] ทดสอบ HSTS บน HTTPS และ Cache-Control: no-store:** เพิ่ม Integration Tests ครบใน `JwtAuthenticationWebTests.cs` (`HstsHeader_IsEmitted_WhenHttpsAndOutsideDevelopment`, `PdfContractDownload_EmitsNoStoreCacheControl`) และอัปเดต [ADR-0011](./docs/adr/0011-authentication-with-own-jwt.md)
5. **[เสร็จแล้ว] ป้องกันค่าสำรอง dev connection string:** ปรับปรุง `TanPmsDbContextFactory` ให้ตรวจสอบ Environment หากรันนอก `Development`/`Testing` แล้วไม่มี `ConnectionStrings__DefaultConnection` จะโยน Exception ทันที พร้อม Unit Test
6. **[เลื่อนตามนโยบาย] ไม่มี forgot-password และ MFA:** บันทึกเป็น Known Constraint ใน [ADR-0011](./docs/adr/0011-authentication-with-own-jwt.md) และ [roadmap](./docs/00-overview/implementation-roadmap.md) (ต้องรอตัวส่ง Email/LINE ภายนอกก่อน)
7. **[เลื่อนตามนโยบาย] ทดสอบเบราว์เซอร์กับ backend จริง:** หน้าจอทั้งหมดผ่านการทดสอบ Wired Vitest (347 tests) แล้ว เลื่อนการรัน Live Browser ไว้ตามนโยบาย
8. **[เสร็จแล้ว] ตรวจสอบ OrderBy ก่อน ToPage และ Audit ครบทุก Handler:** ตรวจสอบทั้ง 18 endpoints ใน Store ทั้งสองฝั่งมี `OrderBy`/`OrderByDescending` ครบถ้วน, ตรวจสอบ Handler ประเภท Delete/Cancel/Void/Deactivate บันทึก `AuditEvent` ครบทุกตัว และเพิ่ม `IAuditLogger` ให้กับ `CheckInStayHandler` พร้อมอัปเดต [ADR-0007](./docs/adr/0007-server-side-pagination-contract.md) และ [ADR-0010](./docs/adr/0010-delete-cancel-void-policy.md)

## 4. จุดที่ต้องรู้ในโค้ด
- Backend: Clean Architecture 4 โปรเจกต์; store แบบ partial class `EfCorePmsStore.*` และ `InMemoryOperationalService.*` (แก้ฟีเจอร์ต้องแก้ทั้งสอง store); `Result<T>`; error ผ่าน `ProblemDetailsMapper` + `Errors.resx`/`Errors.en.resx`
- Auth: access token 15 นาที มีเฉพาะ sub/scope/jti/iat/exp/kid สิทธิ์ resolve ต่อ request จาก store; refresh token เก็บ SHA-256 หมุนทุกครั้ง มี grace 10 วินาที; `Auth:Mode` = `Jwt` | `Headers` (Headers เฉพาะ Development/Testing); ตัวแปรสภาพแวดล้อมดู [.env.example](./.env.example)
- OpenAPI: `contracts/openapi/tan-pms.v1.json` แก้ด้วยมือ `OpenApiContractTests` ตรวจ endpoint parity, operationId ไม่ซ้ำ, `$ref`, schema เทียบ record ถ้าเพิ่ม endpoint ต้องอัปเดตสัญญาแล้วรัน `npm run generate:api`
- Frontend: TanStack Query + `ApiClient` กลาง (Bearer + refresh แบบ single-flight; access token ในหน่วยความจำ, refresh token ใน sessionStorage); ใช้ `invalidateOperationalCaches` และ `useServerPagination`, `ReasonDialog`
- ข้อควรระวัง zsh: อย่าใช้ `grep --include=*.cs` แบบไม่ใส่เครื่องหมายคำพูด (glob พังแล้วได้ผล "ไม่พบ" ผิดๆ)

## 5. คำสั่งตรวจก่อนส่งงาน (ตามหมวด 8 ของ AGENTS.md)
```bash
npm run verify:docs
dotnet build backend/TanPms.slnx
dotnet test backend/tests/TanPms.UnitTests --no-build
dotnet test backend/tests/TanPms.ArchitectureTests --no-build
dotnet test backend/tests/TanPms.IntegrationTests --no-build   # ต้องมี Postgres
cd frontend && npm run generate:api && npx tsc --noEmit && npx vitest run && npm run build
```
ระหว่างพัฒนารันเฉพาะส่วนที่แตะ (`dotnet test --filter`, `npx vitest run <ไฟล์>`) และรันชุดเต็มหนึ่งรอบก่อนส่งมอบ ห้ามอ้างว่าเสร็จถ้ายังไม่ได้รันจริง

## 6. เอกสารอ้างอิง
[docs/00-overview/implementation-roadmap.md](./docs/00-overview/implementation-roadmap.md) (สถานะหลัก + คำตัดสินใจ 2026-11-12) · [ADR-0011 auth](./docs/adr/0011-authentication-with-own-jwt.md) · [error-contract](./docs/03-contracts/error-contract.md) · [.agents/skills/tiered-orchestration/SKILL.md](./.agents/skills/tiered-orchestration/SKILL.md) (การแบ่งงาน Argon/Flash)

## 7. ข้อเสนอ ลำดับถัดไป
เริ่มจากถามผู้ใช้เลือกหัวข้อในข้อ 3 (แนะนำ: ข้อ 7 ทดสอบเบราว์เซอร์แบบ bug log ก่อน หรือข้อ 1 ถ้าต้องการเปลี่ยนอัตรา VAT) อย่าเริ่มงานเองโดยไม่ได้รับคำสั่ง
