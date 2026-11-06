# เอกสารออกแบบระบบ (Design Specification): tan-pms — Enterprise Property Management System

- **วันที่:** 2026-11-06
- **สถานะ:** Draft (รอการตรวจสอบและอนุมัติ)
- **มาตรฐานอ้างอิง:** `scaffold-enterprise-core` และ `tan-erp/AGENTS.md`

---

## 1. เจตนารมณ์และเหตุผล (Intent & The Why)

**`tan-pms`** คือระบบบริหารจัดการที่พักและห้องเช่าระดับองค์กร (Enterprise Property Management System) สำหรับ **องค์กรเดียวที่มีหลายตึก/หลายสาขา (Single-Organization, Multi-Property/Branch)** ซึ่งต้องการรวมการบริหารที่พักทั้ง **3 รูปแบบการเข้าพัก (`StayMode`)** ไว้ในแพลตฟอร์มเดียวโดยไม่เกิดข้อมูลขัดแย้ง:

1. **รายชั่วโมง (`Hourly` / Short-stay):** เน้นความเร็วหน้าเคาน์เตอร์ (Quick Walk-in), การคิดราคาตามแพ็กเกจชั่วโมงเริ่มต้น + ชั่วโมงถัดไป, การเตือนเมื่อใกล้หมดเวลา, การปัดเป็นรายวันอัตโนมัติเมื่อเกินเพดาน และการเผื่อเวลาทำความสะอาด (`Turnaround Buffer`)
2. **รายวัน (`Daily` / Hotel & Daily Rental):** เน้นการจองล่วงหน้าตามประเภทห้อง (`UnitType`) หรือระบุเลขห้อง (`Unit`), ราคาตามฤดูกาล/วันหยุด, บัญชีค่าใช้จ่ายประจำห้อง (`Guest Folio`), เงินมัดจำกุญแจ และรายงานผู้เข้าพักตามกฎหมายไทย (ร.ร.4 / ตม.30)
3. **รายเดือน (`Monthly` / Apartment & Long-stay Lease):** เน้นการบริหารสัญญาเช่าระยะยาว (`Lease`), เงินประกันสัญญา, การจดมิเตอร์น้ำ-ไฟแบบตารางเร็ว (Bulk Meter Reading), การออกใบแจ้งหนี้รายเดือนอัตโนมัติ (Batch Billing Run), ทะเบียนผู้พักร่วม/รถยนต์ และการจัดการพัสดุ

ระบบแบ่งผู้ใช้งานออกเป็น 2 ฝั่งอย่างชัดเจนใน Codebase เดียว:
- **`admin` (ฝั่งพนักงานและผู้บริหาร):** จัดการตึก/ห้อง, ตารางห้องว่าง, หน้าเคาน์เตอร์, สัญญาเช่า, มิเตอร์น้ำ-ไฟ, แคชเชียร์/กะส่งเงิน, แม่บ้าน, งานแจ้งซ่อม และรายงานวิเคราะห์
- **`client` (ฝั่งลูกค้าและผู้เช่า):** จองห้องพักออนไลน์ (พร้อมระบบล็อกห้องชั่วคราวระหว่างโอนเงิน), ดูสัญญาเช่า, ดูใบแจ้งหนี้/กราฟค่าน้ำ-ไฟ, แนบสลิปชำระเงิน, แจ้งซ่อม และรับแจ้งเตือนพัสดุ

---

## 2. เป้าหมาย, สิ่งที่ไม่อยู่ในขอบเขต และสิ่งที่ต้องหลีกเลี่ยง (Goals, Non-Goals & Anti-Goals)

### 2.1 เป้าหมาย (Goals)
1. **วางรากฐานเอกสารและธรรมาภิบาล (Governance First):** มี `AGENTS.md`, `CONTEXT.md`, `design.md` และโครงสร้าง `docs/00-overview` ถึง `06-operations` + `docs/adr/` ครบตามมาตรฐาน `scaffold-enterprise-core` และ `tan-erp` ก่อนเริ่มเขียนโค้ดฟีเจอร์
2. **ป้องกันการจองซ้อน 100% (Zero Double-Booking):** ใช้กลไกระดับฐานข้อมูล (`PostgreSQL tstzrange` + `EXCLUDE USING gist` หรือ Row/Advisory Lock) ร่วมกับระบบล็อกโควตาชั่วคราว (`Booking Hold TTL`)
3. **ความถูกต้องทางการเงินและตรวจสอบย้อนหลังได้ (Financial & Audit Integrity):** มีระบบเปิด-ปิดกะแคชเชียร์ (`CashierShift`), ทะเบียนคุมเงินมัดจำ/เงินประกัน (`DepositLedger`), แยกประเภทภาษีรายบรรทัด (Exempt / VAT 7% / WHT) และห้ามลบเอกสารการเงินที่ออกแล้ว
4. **แยกขอบเขตข้อมูลอัตโนมัติ (Strict Scope Isolation):** พนักงานใน `admin` เห็นเฉพาะสาขา (`Property`) ที่ได้รับสิทธิ์ และลูกค้าใน `client` เห็นเฉพาะใบจอง/สัญญา/บิลของตนเองเท่านั้น

### 2.2 สิ่งที่ไม่อยู่ในขอบเขตระยะแรก (Non-Goals)
1. **ไม่ทำระบบ Multi-Organization SaaS ข้ามบริษัท:** ระบบนี้ใช้ภายในองค์กรเดียวที่มีหลายตึก/สาขา (แต่ใช้ `PropertyId` เป็นแกนแยกข้อมูลสาขาตั้งแต่วันแรก)
2. **ไม่ทำระบบบัญชีแยกประเภทเต็มรูปแบบ (Full GL Accounting):** ระบบออกใบแจ้งหนี้, ใบเสร็จรับเงิน, ใบกำกับภาษี และรายงานส่งบัญชี แต่ไม่ทำงบดุล/งบกำไรขาดทุนระดับบัญชีแยกประเภท
3. **ไม่ทำแอปมือถือแยก (`Flutter`) ในระยะตั้งต้น:** ใช้เว็บ `Next.js` แบบ Responsive ทั้งฝั่ง `admin` (รวมถึงหน้าจอแม่บ้าน/ช่าง/จดมิเตอร์บนมือถือ) และฝั่ง `client`

### 2.3 สิ่งที่ถือเป็นความล้มเหลวแม้ระบบรันได้ (Anti-Goals)
1. **เวลาจองรายชั่วโมง/รายวัน/รายเดือนทับกันได้** หรือปล่อยให้เปิดห้องที่สถานะความสะอาดยังเป็น `Dirty` / `OutOfOrder` โดยไม่มีสิทธิ์ Override
2. **การปะปนกันของคำศัพท์และโมเดลข้อมูล** เช่น นำบิลรายเดือนที่มีมิเตอร์น้ำ-ไฟไปปนกับ `Folio` รายชั่วโมงโดยไม่มีโครงสร้างแยกที่ชัดเจน
3. **การหลุดมาตรฐาน UI/Code ของตระกูล `tan-*`:** การใช้ `any`, การ Hardcode ข้อความภาษาเดียว, การใส่สี Hex หรือมุมโค้งมนนอกเหนือจาก Design Tokens, หรือการเขียน `array.find()` จับคู่ Foreign Key เองที่ฝั่ง Frontend

---

## 3. ข้อจำกัดและเสาหลักสถาปัตยกรรม (Constraints & 8 Enterprise Core Pillars)

### 3.1 Tech Stack ที่กำหนดแล้ว
- **Backend:** `.NET 10` (`C#`, Clean Architecture 4 ชั้น: `Domain`, `Application`, `Infrastructure`, `WebApi`)
- **Database:** `PostgreSQL` + `EF Core 10` (Writes/Transactions/Migrations) + `Dapper` (Complex Reads เช่น Timeline ห้องพัก, Bulk Meter, รายงาน KPI)
- **Frontend:** `Next.js (App Router)` + `React 19` + `TypeScript (Strict)` + `Tailwind CSS` + `TanStack Query` + `React Hook Form` + `Zod` + `next-intl` (`th` เริ่มต้น + `en`)
- **Contract & Docs:** `OpenAPI` (`contracts/openapi/tan-pms.v1.json`) → `openapi-typescript`, เอกสาร PDF สร้างด้วย `QuestPDF`

### 3.2 การประยุกต์ใช้ 8 เสาหลักจาก `scaffold-enterprise-core`

| # | เสาหลัก (Pillar) | การตัดสินใจสำหรับ `tan-pms` | วิธีตรวจสอบ (Verification Gate) |
|---|---|---|---|
| 1 | **Identity & Tenancy** | แยก 2 แกน: ฝั่ง `admin` บังคับกรองตาม `PropertyId` ที่ได้รับมอบหมาย + Permission Key; ฝั่ง `client` บังคับกรองตาม `CustomerId` ของผู้ล็อกอิน | Integration Test: พนักงานสาขา A ขอข้อมูลสาขา B หรือลูกค้า A ขอดูบิลลูกค้า B ต้องไม่พบข้อมูล (404 / Empty) |
| 2 | **Audit & Soft Delete** | ทุก Entity มี `CreatedAt/By`, `UpdatedAt/By`, `IsDeleted/DeletedAt/By` ผ่าน EF Core Interceptor กลาง + ตาราง `AuditEvent` สำหรับการแก้เลขมิเตอร์, ยกเลิกบิล, คืนมัดจำ, เปลี่ยนสิทธิ์ | Integration Test: แก้ไขและลบข้อมูลแล้วตรวจฟิลด์ Audit + Global Filter ซ่อนรายการที่ลบ |
| 3 | **Error Contract** | ใช้ **RFC 9457 Problem Details** ทั้งระบบ พร้อม `errorCode` เสถียรที่แปลเป็น `th`/`en` ได้ที่ Frontend | Test ยิง Validation / NotFound / Forbidden / Conflict ได้โครงสร้าง Problem Details เดียวกัน และไม่มี Stack Trace |
| 4 | **Numbering** | รันเลขเอกสารแบบ Atomic ต่อสาขาและรอบรีเซ็ตด้วยตาราง `DocumentSequence` (`INSERT ... ON CONFLICT DO UPDATE RETURNING`) รูปแบบ `{PROP}-{DOC}-{YY}{MM}-{SEQ:4}` | Concurrency Test: ยิงขอเลขเอกสาร 100 ครั้งพร้อมกันต้องไม่ซ้ำและไม่ล้ม |
| 5 | **Storage** | ไฟล์แนบ (สลิป, รูปบัตรประชาชน, สัญญา, รูปแจ้งซ่อม, รูปพัสดุ) อยู่หลัง `IFileStorage` อัปโหลดจริงตอนกด Submit เท่านั้นผ่าน `useDeferredFileUpload` และเปิดดูผ่าน Endpoint ที่ตรวจสิทธิ์ | UI/Integration Test: เลือกไฟล์แล้วกดยกเลิกต้องไม่มี Request อัปโหลด; ผู้ไม่มีสิทธิ์เปิด URL ไฟล์ต้องได้ 403/404 |
| 6 | **Token-driven UI** | ใช้มาตรฐาน **Ollama Minimal Design System** (`#000000` บนพื้นขาว `#ffffff`, รูปทรงแคปซูล `9999px` สำหรับทุกปุ่ม/ช่องกรอก, การ์ดขอบบาง `12px` และการ์ดสีเข้ม `#171717` เพียง 1 จุดต่อหน้า) ผ่าน CSS Variables และ `shadcn/ui` Component กลาง | ESLint/Style Check ห้ามใส่สี Hex นอกระบบ Token ใน Component |
| 7 | **i18n** | ทุกข้อความบน UI ทั้งฝั่ง `admin` และ `client` ดึงจาก `messages/th.json` และ `messages/en.json` | Script ตรวจ Parity ระหว่าง `th.json` กับ `en.json` ใน CI |
| 8 | **Testing** | Architecture Test (`ArchUnitNET`), Unit Test (สูตรราคา/มิเตอร์/ภาษี), Integration Test (`Testcontainers.PostgreSql`), Frontend Test (`Vitest`/`Playwright`) | CI Pipeline ต้องเขียวครบทุก Gate ก่อน Merge |

---

## 4. คำศัพท์ธุรกิจและสถานะเอกสารหลัก (`CONTEXT.md` Blueprint)

### 4.1 คำศัพท์หลัก (Ubiquitous Language)

| คำในโค้ด (Term) | ชื่อไทย | ความหมาย | คำที่ห้ามใช้แทน |
|---|---|---|---|
| `Property` | สาขา / โครงการที่พัก | หน่วยปฏิบัติงานระดับสาขาหรือโครงการ ซึ่งประกอบด้วยอาคารตั้งแต่ 1 อาคารขึ้นไป และใช้เป็นขอบเขตสิทธิ์ (`PropertyId`) และรหัสเลขที่เอกสาร | `Branch`, `Hotel`, `Site` |
| `Building` | อาคาร / ตึก | อาคารภายใต้ `Property` | `Tower`, `Block` |
| `Floor` | ชั้น | ชั้นภายใน `Building` | `Level`, `Storey` |
| `UnitType` | ประเภทห้องพัก | รูปแบบมาตรฐานของห้อง (เช่น Standard, Deluxe, Studio 28 ตร.ม.) ใช้ตั้งราคาและรับจองโควตาก่อนระบุเลขห้อง | `RoomType`, `Category` |
| `Unit` | ห้องพัก / ยูนิต | ห้องพักจริงที่มีเลขห้องชัดเจน (เช่น `A-301`) และมีสถานะการครองห้อง + สถานะความสะอาด | `Room`, `Apartment` |
| `StayMode` | รูปแบบการเข้าพัก | โหมดการคิดเวลาและราคา: `Hourly` (รายชั่วโมง), `Daily` (รายวัน), `Monthly` (รายเดือน) | `RentalType`, `BookingType` |
| `Customer` | ลูกค้า / ผู้เช่า | บุคคลหรือนิติบุคคลที่เป็นผู้จอง ผู้เข้าพัก (`Guest`) หรือคู่สัญญาเช่ารายเดือน (`Tenant`) | `ClientUser`, `Member` |
| `Occupant` | ผู้พักอาศัย | บุคคลที่เข้าพักจริงในห้อง (รวมทั้งผู้เช่าหลักและผู้พักร่วม `CoOccupant` เพื่อใช้ทำทะเบียน ร.ร.4 / ตม.30) | `Visitor`, `Resident` |
| `Reservation` | ใบจองห้องพัก | การจองล่วงหน้าสำหรับรายชั่วโมง/รายวัน/รายเดือน ซึ่งอาจล็อกเฉพาะโควตา `UnitType` หรือล็อกเลข `Unit` และมีกลไก `HoldExpiresAt` (TTL) | `Booking`, `Order` |
| `Stay` | การเข้าพัก (รายชั่วโมง/รายวัน) | รายการเข้าพักจริงตั้งแต่ `CheckIn` จนถึง `CheckOut` สำหรับโหมด `Hourly` และ `Daily` | `Visit`, `CheckInRecord` |
| `Folio` | บัญชีค่าใช้จ่ายประจำการเข้าพัก | กระเป๋าบันทึกค่าห้อง, ค่าชั่วโมงเกินเวลา, มินิบาร์, ค่าเสียหาย และเงินมัดจำของ `Stay` หนึ่งรายการ | `Tab`, `StayBill` |
| `Lease` | สัญญาเช่ารายเดือน | สัญญาเช่าระยะยาวสำหรับโหมด `Monthly` ที่ระบุวันเริ่ม-สิ้นสุดสัญญา, เงินประกัน, ค่าเช่ารายเดือน และเลขมิเตอร์ตั้งต้น | `Contract`, `Agreement` |
| `MeterReading` | บันทึกเลขมิเตอร์ | การจดเลขมิเตอร์น้ำ/ไฟของแต่ละ `Unit` ประจำรอบบิล พร้อมภาพถ่ายและหน่วยที่ใช้ไป | `UtilityLog`, `MeterUsage` |
| `Invoice` | ใบแจ้งหนี้ | เอกสารเรียกเก็บเงิน (ทั้งจาก `Folio` หรือจากรอบบิลรายเดือน `Lease`) แยกรายการภาษีรายบรรทัด | `Bill`, `Statement` |
| `Receipt` | ใบเสร็จรับเงิน / ใบกำกับภาษี | เอกสารยืนยันการรับชำระเงินที่ออกหลังตรวจรับเงินสดหรืออนุมัติสลิปโอนเงินแล้ว | `PaymentVoucher`, `Slip` |
| `CashierShift` | กะแคชเชียร์ | รอบการทำงานของพนักงานรับ-จ่ายเงินหน้าเคาน์เตอร์ (เปิดกะ → รับ/คืนเงิน → นับเงินปิดกะ) | `DrawerSession`, `WorkShift` |
| `DepositLedger` | ทะเบียนคุมเงินมัดจำ/เงินประกัน | บัญชีติดตามเงินมัดจำกุญแจ, เงินมัดจำจอง และเงินประกันสัญญาเช่า (รับ → หักค่าเสียหาย → คืน) | `DepositHistory` |
| `HousekeepingTask` | งานทำความสะอาดห้อง | งานแม่บ้านที่ผูกกับการเปลี่ยนสถานะความสะอาดของ `Unit` (`Dirty` → `Cleaning` → `Inspecting` → `Clean`) | `CleaningJob` |
| `WorkOrder` | ใบแจ้งซ่อม | รายการแจ้งซ่อมบำรุงจากฝั่ง `admin` หรือ `client` พร้อมระบุว่าคิดค่าใช้จ่ายกับผู้เช่าหรือไม่ | `MaintenanceTicket`, `RepairJob` |
| `Parcel` | พัสดุผู้เช่า | รายการพัสดุที่มาส่งหน้าเคาน์เตอร์เพื่อให้ผู้เช่าในฝั่ง `client` มารับ | `Package`, `Delivery` |

### 4.2 รหัสเอกสารมาตรฐาน (Document Numbering Prefix)
- `RES`: ใบจองห้องพัก (`Reservation`)
- `STY`: รายการเข้าพักรายชั่วโมง/รายวัน (`Stay`)
- `LSE`: สัญญาเช่ารายเดือน (`Lease`)
- `INV`: ใบแจ้งหนี้ (`Invoice`)
- `RCT`: ใบเสร็จรับเงิน/ใบกำกับภาษี (`Receipt`)
- `DEP`: ใบรับ/คืนเงินประกัน (`DepositTransaction`)
- `SHF`: รอบกะแคชเชียร์ (`CashierShift`)
- `WKO`: ใบแจ้งซ่อม (`WorkOrder`)
- `PCL`: รายการรับพัสดุ (`Parcel`)

### 4.3 สถานะ (State Machine) ของเอนทิตีและเอกสารหลัก

| เอกสาร / เอนทิตี | สถานะที่เป็นไปได้ | กฎการเปลี่ยนสถานะที่สำคัญ |
|---|---|---|
| `Unit.OccupancyStatus` | `Vacant`, `Occupied`, `Reserved`, `Blocked` | เปลี่ยนผ่านตามการ Check-in, Check-out, สัญญาเช่าที่มีผล หรือการบล็อกห้องซ่อม |
| `Unit.ConditionStatus` | `Clean`, `Dirty`, `Cleaning`, `Inspecting`, `OutOfOrder` | เมื่อ `Stay` หรือ `Lease` สิ้นสุดจะเปลี่ยนเป็น `Dirty` อัตโนมัติ; ห้าม Check-in รายใหม่ถ้าไม่เป็น `Clean` (เว้นแต่มีสิทธิ์ `admin.stay.override_dirty_checkin`) |
| `Reservation` | `Hold` (TTL), `PendingVerification`, `Confirmed`, `CheckedIn`, `Expired`, `Cancelled`, `NoShow` | จองผ่าน `client` เริ่มที่ `Hold` (ล็อกโควตาตามเวลา TTL เช่น 15 นาที) → แนบสลิปเป็น `PendingVerification` → `admin` อนุมัติสลิปเป็น `Confirmed` → เข้าพักเป็น `CheckedIn`; หากเกินเวลา TTL โดยไม่แนบสลิปจะเปลี่ยนเป็น `Expired` และคืนโควตาอัตโนมัติ |
| `Stay` | `Active`, `CheckedOut`, `Cancelled` | เมื่อ `CheckedOut` ต้องเคลียร์ยอดค้างใน `Folio` และคืนเงินมัดจำกุญแจให้เรียบร้อย |
| `Lease` | `Draft`, `PendingSignature`, `Active`, `MoveOutNotice`, `MovedOut`, `Terminated`, `Cancelled` | ห้องที่มี `Lease = Active` หรือ `MoveOutNotice` จะถูกบล็อกไม่ให้รับจอง `Hourly`/`Daily` ตลอดช่วงสัญญา |
| `Invoice` | `Draft`, `Issued`, `PartiallyPaid`, `Paid`, `Overdue`, `Voided` | ห้ามลบ `Invoice` ที่ `Issued` แล้ว หากผิดพลาดต้อง `Voided` พร้อมระบุเหตุผลและออกใบใหม่ |
| `CashierShift` | `Open`, `Closed`, `Reconciled` | พนักงานที่จะรับ/คืนเงินสดหน้าเคาน์เตอร์ต้องมี `CashierShift` สถานะ `Open` ของตนเอง |

---

## 5. โครงสร้างโฟลเดอร์และสถาปัตยกรรมระบบ (Directory & System Structure)

ใช้ชื่อ **`admin`** สำหรับฝั่งพนักงาน/ผู้บริหาร และ **`client`** สำหรับฝั่งลูกค้า/ผู้เช่า:

```text
tan-pms/
├── AGENTS.md                        # กฎเหล็กสำหรับคนและ AI Agent (ยึดตาม tan-erp + PMS rules)
├── CONTEXT.md                       # พจนานุกรมคำศัพท์ธุรกิจ (Ubiquitous Language) & State Machine
├── design.md                        # มาตรฐาน UI/UX, Design Tokens (Atelier Architectural Navy Sharp)
├── Makefile                         # คำสั่งมาตรฐาน (build, test, lint, verify, migrate)
├── .github/workflows/               # CI/CD Gates
├── .agents/skills/                  # Skills เฉพาะโปรเจกต์ (building-pms-forms, building-pms-lists, pms-numbering)
├── contracts/
│   └── openapi/tan-pms.v1.json      # Single Source of Truth ของ API Contract
├── design-tokens/                   # Primitive & Semantic Tokens
├── docs/
│   ├── README.md                    # แผนที่เอกสารทั้งหมด แยกตามบทบาทผู้อ่าน
│   ├── 00-overview/                 # product-vision.md, scope-and-non-goals.md, implementation-roadmap.md
│   ├── 01-business/                 # Flows, Rate/Meter/Tax Calculation Rules, Field Catalogs, Wireframes
│   ├── 02-architecture/             # system-context.md, module-boundaries.md, backend-architecture.md, frontend-architecture.md
│   ├── 03-contracts/                # api-conventions.md, error-contract.md, rbac.md, permission-catalog.md, <slice>-api-contract.md
│   ├── 04-data/                     # conceptual-data-model.md, database-standards.md, availability-locking-policy.md, audit-redaction.md
│   ├── 05-engineering/              # testing-strategy.md, development-ready-gate.md, definition-of-done.md, <slice>-uat-scenarios.md
│   ├── 06-operations/               # environments.md, observability.md, backup-and-restore.md, release-readiness.md
│   ├── adr/                         # 0001-clean-architecture-foundation.md, 0002-hybrid-availability-engine.md, ฯลฯ
│   └── superpowers/
│       ├── specs/                   # เอกสารออกแบบ (Design Specs)
│       └── plans/                   # แผนการพัฒนา (Implementation Plans)
├── backend/
│   ├── Directory.Build.props
│   ├── Directory.Packages.props
│   ├── TanPms.slnx
│   ├── src/
│   │   ├── TanPms.Domain/
│   │   ├── TanPms.Application/
│   │   ├── TanPms.Infrastructure/
│   │   └── TanPms.WebApi/
│   └── tests/
│       ├── TanPms.ArchitectureTests/
│       ├── TanPms.UnitTests/
│       └── TanPms.IntegrationTests/
└── frontend/
    ├── package.json
    └── src/
        ├── app/
        │   ├── (auth)/              # หน้าเข้าสู่ระบบ (แยกหรือสลับโหมด Admin / Client)
        │   ├── (admin)/             # หน้าจอฝั่งพนักงานและผู้บริหาร (/admin/...)
        │   └── (client)/            # หน้าจอฝั่งลูกค้าและผู้เช่า (/client/...)
        ├── components/ui/           # Central UI Components (ห้ามใช้ Raw HTML Controls)
        ├── features/                # แยกตามโมดูลธุรกิจ
        ├── generated/api/           # TypeScript types ที่สร้างจาก OpenAPI
        ├── hooks/                   # useDeferredFileUpload, useFormTabErrors, ฯลฯ
        ├── lib/                     # API Client, Error Mapper, Formatter
        └── messages/                # th.json และ en.json
```

---

## 6. รายละเอียดฟีเจอร์ระดับ Enterprise แบ่งตาม Vertical Slice (`PM-01` – `PM-10`)

### `PM-01` Foundation, Identity, Multi-Property RBAC & Notification Core
- ระบบยืนยันตัวตนแยกบริบทระหว่างผู้ใช้ฝั่ง `admin` (มี `AllowedPropertyIds` + `Permissions`) และผู้ใช้ฝั่ง `client` (ผูกกับ `CustomerId`)
- ระบบจัดการโครงสร้างองค์กรและสาขา (`Property`), บทบาท (`Role`), สิทธิ์ (`Permission Catalog`)
- ระบบรันเลขที่เอกสาร (`DocumentNumberService`) และระบบเก็บไฟล์แนบ (`IFileStorage` + Deferred Upload)
- โครงสร้าง `INotificationSender` พร้อม In-App Notification และ Adapter เตรียมเชื่อมต่อ LINE OA / Email

### `PM-02` Property, Building, Floor, UnitType & Unit Master
- จัดการข้อมูล `Property` (รวมถึงเลขสาขาภาษี 5 หลัก เช่น `00000`), `Building`, `Floor`, `UnitType`, `Unit`
- กำหนด `SupportedStayModes` (`Hourly`, `Daily`, `Monthly`) ได้ทั้งระดับ `UnitType` และ Override ระดับ `Unit`
- ทะเบียนทรัพย์สินและอุปกรณ์ประจำห้อง (`UnitAsset` เช่น แอร์, ทีวี, ตู้เย็น, คีย์การ์ด) พร้อมราคาชดใช้มาตรฐานกรณีชำรุด

### `PM-03` Rate Plans, Hourly Packages, Utility Tariffs & Tax Rules
- **กฎราคารายชั่วโมง (`HourlyRateRule`):** ราคาแพ็กเกจชั่วโมงเริ่มต้น (เช่น 3 ชม. แรก X บาท), ราคาต่อชั่วโมงถัดไป, ระยะเวลาผ่อนผัน (`GracePeriodMinutes` เช่น 15 นาที), เพดานราคาที่ปัดเป็นรายวันอัตโนมัติ (`AutoCapToDailyRate`), และเวลาเผื่อแม่บ้านทำความสะอาด (`TurnaroundBufferMinutes` เช่น 30 นาที)
- **กฎราคารายวัน (`DailyRatePlan`):** ราคาตามวันในสัปดาห์ (Weekday/Weekend), วันหยุดพิเศษ, ค่าผู้เข้าพักเสริม/เตียงเสริม
- **กฎราคารายเดือนและสาธารณูปโภค (`MonthlyRate & UtilityTariff`):** ค่าเช่าตามอายุสัญญา, อัตราค่าน้ำ-ค่าไฟ (คิดตามหน่วยจริง / ขั้นต่ำ / เหมาจ่าย / อัตราก้าวหน้า)
- **กฎภาษีรายประเภทค่าใช้จ่าย (`TaxProfile`):** กำหนดได้รายประเภทค่าใช้จ่ายว่า `Exempt` (ยกเว้น VAT เช่น ค่าเช่าห้องรายเดือน), `VatIncluded` หรือ `VatExcluded` (เช่น ค่าบริการ/เฟอร์นิเจอร์/รายวัน) และรองรับการคำนวณภาษีหัก ณ ที่จ่าย (`WithholdingTax`)

### `PM-04` Unified Availability Engine, Booking Hold (TTL) & Reservation (`admin` + `client`)
- **การจอง 2 รูปแบบ:**
  1. **UnitType Quota Booking:** ลูกค้าจองผ่าน `client` (รายชั่วโมง/รายวัน) ระบบจะตัดโควตาว่างของ `UnitType` ในช่วงเวลานั้นก่อน แล้วให้ `admin` กดจัดสรรเลขห้อง (`Assign Unit`) ก่อนหรือขณะ Check-in
  2. **Specific Unit Booking:** จองรายเดือน หรือ `admin` เลือกเลขห้องเองหน้าเคาน์เตอร์ ระบบล็อก `UnitId` ทันที
- **Booking Hold (TTL):** การจองจาก `client` ที่รอชำระเงินมัดจำจะอยู่ในสถานะ `Hold` พร้อม `HoldExpiresAt` (ค่าเริ่มต้น 15 นาที ตั้งค่าได้ระดับ `Property`) โดยมี Background Worker / Query Filter คืนโควตาอัตโนมัติทันทีที่หมดเวลา
- **หน้าจอ Unified Room Rack & Tape Chart (`admin`):** มองเห็นทั้ง Slot รายชั่วโมง, วันเข้า-ออกรายวัน และห้องที่ติดสัญญารายเดือนในตารางเดียว

### `PM-05` Front Desk: Hourly & Daily Stay, Guest Folio & Regulatory Export (`admin`)
- **Quick Walk-in & Check-in:** เลือกห้องว่างที่สถานะ `Clean` → บันทึกผู้เข้าพักหลักและผู้พักร่วม (`Occupant`) → เก็บเงินมัดจำกุญแจ → เปิด `Stay` และ `Folio` ในขั้นตอนเดียว
- **Live Timer & Extend Stay:** แดชบอร์ดแสดงเวลาคงเหลือของห้องรายชั่วโมง แจ้งเตือนเมื่อใกล้หมดเวลา กดต่อชั่วโมง หรือคำนวณค่าปรับเกินเวลาเข้า `Folio` อัตโนมัติ
- **Check-out & Folio Settlement:** รวมค่าห้อง + ค่าบริการเสริม/มินิบาร์ + ค่าปรับความเสียหาย หักกลบหรือคืนเงินมัดจำกุญแจ และเปลี่ยนสถานะห้องเป็น `Dirty` พร้อมสร้างงานแม่บ้านอัตโนมัติ
- **Regulatory Export:** ส่งออกรายงานทะเบียนผู้เข้าพักตามแบบ **ร.ร.4** และข้อมูลผู้เข้าพักต่างชาติสำหรับแจ้ง **ตม.30 (TM.30)**

### `PM-06` Monthly Lease Lifecycle, Co-occupants & Vehicle Registry (`admin` + `client`)
- สร้างสัญญาเช่ารายเดือน (`Lease`), พิมพ์สัญญา PDF (`QuestPDF`), บันทึกเงินประกันสัญญา + ค่าเช่าล่วงหน้าเข้า `DepositLedger`
- **Move-in Inspection:** บันทึกเลขมิเตอร์น้ำ-ไฟตั้งต้น, ตรวจรายการทรัพย์สินในห้อง และแนบรูปถ่ายสภาพห้องวันส่งมอบ
- **Co-occupants & Vehicles:** บันทึกผู้พักอาศัยร่วมและทะเบียนรถยนต์/รถจักรยานยนต์ประจำห้อง (`admin` ค้นหาเลขห้องจากป้ายทะเบียนรถได้ทันที)
- **Renewal, Transfer & Move-out Settlement:** ต่อสัญญา, ย้ายห้องระหว่างสัญญา, รับแจ้งย้ายออกล่วงหน้า, จดมิเตอร์วันย้ายออก, หักค่าน้ำ-ไฟ/ค่าซ่อมจากเงินประกัน และทำเรื่องคืนเงินประกันสุทธิ

### `PM-07` Bulk Utility Meter Reading & Batch Monthly Billing (`admin`)
- **Bulk Meter Entry:** ตารางกรอกเลขมิเตอร์น้ำ-ไฟแยกตามตึกและชั้น ดึงเลขเดือนก่อนหน้ามาแสดงคู่กัน คำนวณหน่วยใช้ไปแบบสด (Zero-Layout-Shift) พร้อมดักจับความผิดปกติ (เช่น เลขมิเตอร์น้อยกว่าเดือนก่อน หรือหน่วยพุ่งสูงเกินเกณฑ์) และรองรับการแนบรูปถ่ายมิเตอร์
- **Batch Invoice Run:** สร้างใบแจ้งหนี้รายเดือน (`Invoice` สถานะ `Draft`) ยกตึกในคลิกเดียว → ตรวจสอบ/แก้ไขรายการ → กดอนุมัติออกบิล (`Issue`) พร้อมส่งแจ้งเตือนไปยังฝั่ง `client`

### `PM-08` Cashier Shift, Payment Slip Verification & Deposit Ledger (`admin` + `client`)
- **Cashier Shift (`Open` / `Close` / `Reconcile`):** พนักงานหน้าเคาน์เตอร์เปิดกะด้วยเงินทอนตั้งต้น ระบบผูกทุกรายการรับ-จ่ายเงินสดและเงินมัดจำเข้ากับ `CashierShiftId` ตอนปิดกะพนักงานกรอกยอดเงินสดที่นับได้จริงเพื่อเทียบยอดระบบและบันทึกส่วนต่าง (`CashVariance`)
- **Slip Verification Queue (Maker-Checker):** เมื่อลูกค้า/ผู้เช่าแนบสลิปโอนเงินจากฝั่ง `client` รายการจะเข้าคิวรอตรวจในฝั่ง `admin` เมื่อกดอนุมัติระบบจะตัดยอด `Invoice` และออก `Receipt` PDF อัตโนมัติ
- **Deposit Ledger:** ทะเบียนคุมเงินมัดจำกุญแจ, เงินมัดจำจอง และเงินประกันสัญญาเช่าแยกชัดเจน ไม่ปนกับรายได้ค่าห้องจนกว่าจะมีการริบหรือหักชำระ

### `PM-09` Housekeeping, Maintenance Work Orders & Parcel Management (`admin` + `client`)
- **Housekeeping Board:** แม่บ้านดูรายการห้อง `Dirty` แยกตามตึก/ชั้น กดเริ่มทำความสะอาด (`Cleaning`) → เสร็จสิ้น (`Inspecting` หรือ `Clean`)
- **Maintenance Work Orders (`WorkOrder`):** ผู้เช่ากดแจ้งซ่อมพร้อมแนบรูปจากหน้า `client` (หรือ `admin` เปิดใบงานเอง) → มอบหมายช่าง → บันทึกผลซ่อมและรูปหลังซ่อม → หากเป็นความเสียหายจากผู้เช่าสามารถส่งยอดค่าซ่อมเข้า `Invoice` หรือ `Folio` ได้ทันที
- **Parcel Management (`Parcel`):** `admin` บันทึกรับพัสดุหน้าเคาน์เตอร์ (ถ่ายรูปกล่อง + เลือกเลขห้อง) → แจ้งเตือนขึ้นที่หน้า `client` → บันทึกการรับพัสดุเมื่อผู้เช่ามารับ

### `PM-10` Client Self-Service Experience & Executive Analytics (`client` + `admin`)
- **ฝั่ง `client` (`/client/...`):**
  - หน้าค้นหาห้องว่างและจองออนไลน์ (พร้อม Countdown แสดงเวลา `Hold TTL` ขณะชำระเงิน)
  - หน้าแดชบอร์ดผู้เช่า: ดูสัญญาเช่า, ดูใบแจ้งหนี้/กราฟประวัติการใช้น้ำ-ไฟ, แนบสลิปและดาวน์โหลดใบเสร็จ PDF, แจ้งซ่อมและติดตามสถานะ, ดูรายการพัสดุที่รอรับ, แจ้งความประสงค์ต่อสัญญา/ย้ายออก
- **ฝั่ง `admin` Executive Analytics (`/admin/analytics`):**
  - อัตราการเข้าพัก (`Occupancy Rate`) แยกตาม `StayMode` (`Hourly` / `Daily` / `Monthly`) และแยกตาม `Property` / `Building`
  - รายได้เฉลี่ยต่อห้อง (`RevPAR`), รายงานลูกหนี้ค้างชำระ (`Aging Report`), รายงานสรุปกะแคชเชียร์ และสรุปยอดเงินประกันคงเหลือ

---

## 7. มาตรฐานความปลอดภัยและ PDPA (Security & PDPA Baseline)

1. **Server-Side Authorization & Deny by Default:** ทุก Endpoint ต้องระบุ Policy ชัดเจน; การตัดสินสิทธิ์ทำที่ Backend 100%
2. **Dual-Scope Data Isolation:**
   - Endpoint ฝั่ง `/api/v1/admin/...` ต้องผ่าน `AdminScopeFilter` ที่ตรวจสอบว่า `PropertyId` อยู่ใน `CurrentUser.AllowedPropertyIds`
   - Endpoint ฝั่ง `/api/v1/client/...` ต้องผ่าน `ClientScopeFilter` ที่บังคับใช้ `CustomerId == CurrentUser.CustomerId` เสมอ
3. **PDPA & PII Masking:**
   - เลขบัตรประชาชนและหมายเลขหนังสือเดินทางเก็บแยกฟิลด์ที่มีการเข้ารหัสในระดับ Application/Database และแสดงผลแบบ Masking (`1-xxxx-xxxxx-12-3`) เป็นค่าเริ่มต้น ยกเว้นผู้ใช้ที่มีสิทธิ์ `admin.customer.unmask_pii`
   - ห้ามบันทึกเลขบัตรประชาชน, รหัสผ่าน, Token หรือข้อมูลบัตรเครดิตลงใน Log เด็ดขาด (มี Log Redactor กลาง)
4. **Private File Access:** ไฟล์สลิปโอนเงิน, สำเนาบัตรประชาชน และสัญญาเช่าต้องเรียกผ่าน Authorized File Endpoint เท่านั้น ห้ามเปิด Public Bucket
5. **High-Risk Action Audit & Approval:** การยกเลิกใบเสร็จ (`Void`), การลดหนี้, การแก้เลขมิเตอร์ที่ออกบิลไปแล้ว, การคืนเงินประกัน และการเปิดห้องพักโดยไม่คิดเงิน ต้องมี Confirmation Modal ฝั่ง UI, บังคับระบุเหตุผล, ตรวจสิทธิ์แยกเฉพาะ และบันทึกลง `AuditEvent`

---

## 8. การตัดสินใจทางเทคนิคที่กำหนดไว้เป็นมาตรฐานเริ่มต้น (Default Builder Decisions)

รายการต่อไปนี้คือค่าเริ่มต้นที่กำหนดไว้ตามมาตรฐาน `scaffold-enterprise-core` และ `tan-erp` เพื่อให้ทีมพัฒนาทำงานต่อได้ทันทีโดยไม่ต้องเดา (สามารถสั่งเปลี่ยนได้หากต้องการ):

1. **Time-Slot & Availability Representation:** เก็บช่วงเวลาเข้าพักและช่วงเวลาจองด้วย `tstzrange` (UTC Timestamp with Time Zone Range) ใน PostgreSQL โดยใช้ Time Zone มาตรฐานของสาขา (`Asia/Bangkok` เป็นค่าเริ่มต้น) สำหรับคำนวณรอบตัดวันรายวันและรอบบิลรายเดือน
2. **Meter Rollover Handling:** รองรับกรณีมิเตอร์น้ำ/ไฟหมุนครบรอบ (เช่น มิเตอร์ 4 หลักจาก `9995` ไป `0012`) ด้วยฟิลด์ `MeterMaxDigits` และ Flag `IsRolloverConfirmed`
3. **Design Preset:** ใช้ธีม **Ollama Minimal Design System** ตามไฟล์ `DESIGN.md` (`#000000` pure black บน `#ffffff` paper-white canvas, ฟอนต์ `SF Pro Rounded` + `ui-sans-serif` + `ui-monospace`, รูปทรง Pill `9999px` สำหรับทุกปุ่มและช่องกรอก, การ์ด `12px` ขอบ `#e5e5e5`, Terminal Card พร้อมจุดไฟจราจร 3 สี และจุดเน้นสีเข้ม `#171717` เพียง 1 จุดต่อหน้า) ร่วมกันทั้งฝั่ง `admin` และ `client`

---

## 9. สิ่งที่มอบหมายให้ขั้นวางแผนและพัฒนา (Left to the Builder / Implementation Plan)

1. รายละเอียด Schema ระดับคอลัมน์และ Index ของแต่ละตารางในแต่ละ Vertical Slice (`PM-01` ถึง `PM-10`)
2. รายละเอียดหน้าจอ Wireframe รายฟิลด์ของแต่ละ Slice ซึ่งจะถูกเขียนแยกใน `docs/01-business/` และ `docs/03-contracts/` ตามลำดับ Roadmap
3. การตั้งค่า Docker Compose สำหรับ Local Development (`PostgreSQL` + `MinIO/Local Storage`) และ GitHub Actions CI Workflow
