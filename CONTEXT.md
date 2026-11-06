# CONTEXT.md — พจนานุกรมคำศัพท์ธุรกิจและกฎสถานะหลัก (Ubiquitous Language & Domain Context)

เอกสารนี้คือ **แหล่งอ้างอิงเดียว (Single Source of Truth)** สำหรับคำศัพท์โดเมน, รหัสเอกสาร และสถานะ (State Machine) ของระบบ **`tan-pms` (Enterprise Property Management System)**

ทั้งนักพัฒนาและ AI Agent **ต้อง** ใช้คำศัพท์ในเอกสารนี้ตรงกันทุกจุด: ชื่อ Entity/Class ใน `.NET 10`, ชื่อตารางและคอลัมน์ใน `PostgreSQL`, ชื่อ Route/DTO ใน `OpenAPI`, ชื่อตัวแปร/Type ใน `Next.js` และคีย์ภาษาใน `messages/{th,en}.json`

---

## 1. บริบทธุรกิจ (Business Context)

**`tan-pms`** เป็นแพลตฟอร์มบริหารจัดการที่พักและอสังหาริมทรัพย์ให้เช่าระดับองค์กรสำหรับ **องค์กรเดียวที่มีหลายสาขาและหลายอาคาร (Single-Organization, Multi-Property/Multi-Building)** ที่รวมการบริหารที่พักทั้ง **3 รูปแบบการเข้าพัก (`StayMode`)** ไว้ในระบบเดียวโดยไม่เกิดการจองซ้อนหรือข้อมูลการเงินปะปนกัน:

1. **`Hourly` (รายชั่วโมง / Short-stay):** เน้นการเปิดห้องด่วนหน้าเคาน์เตอร์ (Quick Walk-in), แพ็กเกจชั่วโมงเริ่มต้น + ชั่วโมงถัดไป, ตัวจับเวลาสด, การปัดเป็นราคารายวันอัตโนมัติ (`AutoCapToDailyRate`) และเวลาเผื่อแม่บ้านทำความสะอาด (`TurnaroundBufferMinutes`)
2. **`Daily` (รายวัน / Hotel & Daily Rental):** เน้นการจองล่วงหน้าตามโควตา `UnitType` หรือระบุ `Unit`, ราคาตามวันในสัปดาห์/ฤดูกาล, บัญชีค่าใช้จ่ายประจำห้อง (`Folio`), เงินมัดจำกุญแจ และรายงานผู้เข้าพักตามกฎหมายไทย (ร.ร.4 และ ตม.30 / TM.30)
3. **`Monthly` (รายเดือน / Apartment & Long-stay Lease):** เน้นสัญญาเช่าระยะยาว (`Lease`), เงินประกันสัญญา (`DepositLedger`), การจดมิเตอร์น้ำ-ไฟแบบตารางเร็ว (`MeterReading`), การออกใบแจ้งหนี้รายเดือนยกตึก (`Batch Invoice Run`), ทะเบียนผู้พักร่วม/รถยนต์ และการรับพัสดุ (`Parcel`)

### การแบ่งกลุ่มผู้ใช้งาน (Audience & Scopes)

ระบบแบ่งขอบเขตผู้ใช้งานและ Route ออกเป็น 2 ฝั่งอย่างเคร่งครัด:
- **`admin` (`/admin/...`, `/api/v1/admin/...`, `AdminScope`):** สำหรับพนักงานต้อนรับ, แคชเชียร์, แม่บ้าน, ช่างซ่อมบำรุง, ฝ่ายบัญชี และผู้บริหาร ตรวจสอบสิทธิ์ด้วย `AllowedPropertyIds` + Permission Key (**ห้ามใช้คำว่า `staff` หรือ `backoffice`**)
- **`client` (`/client/...`, `/api/v1/client/...`, `ClientScope`):** สำหรับลูกค้าจองห้องพักและผู้เช่ารายเดือน ตรวจสอบสิทธิ์ด้วย `CustomerId` ของผู้ล็อกอิน (**ห้ามใช้คำว่า `portal` หรือ `member`**)

---

## 2. พจนานุกรมคำศัพท์หลัก (Ubiquitous Language — 20 Core Terms)

| # | คำในโค้ด (Canonical Term) | ชื่อไทย | ความหมายและการใช้งานในระบบ | คำต้องห้าม (Forbidden Synonyms) |
|---|---|---|---|---|
| 1 | `Property` | สาขา / โครงการที่พัก | หน่วยปฏิบัติงานระดับสาขาหรือโครงการ ประกอบด้วย 1 อาคารขึ้นไป ใช้เป็นแกนแยกสิทธิ์ (`PropertyId`), เลขสาขาภาษี 5 หลัก และรหัสนำหน้าเลขที่เอกสาร (`{PROP}`) | `Branch`, `Hotel`, `Site`, `Location` |
| 2 | `Building` | อาคาร / ตึก | อาคารภายใต้ `Property` (เช่น อาคาร A, อาคาร B) | `Tower`, `Block`, `Wing` |
| 3 | `Floor` | ชั้น | ชั้นภายใน `Building` ใช้จัดกลุ่มผังห้อง (`Room Rack`) และตารางจดมิเตอร์น้ำ-ไฟ | `Level`, `Storey`, `Deck` |
| 4 | `UnitType` | ประเภทห้องพัก | แม่แบบห้องพัก (เช่น Standard 24 ตร.ม., Deluxe 32 ตร.ม.) ใช้ผูกกฎราคาและรับจองแบบโควตา (`UnitType Quota`) ก่อนระบุเลขห้องจริง | `RoomType`, `Category`, `UnitClass` |
| 5 | `Unit` | ห้องพัก / ยูนิต | ห้องพักจริงที่มีเลขห้องชัดเจน (เช่น `A-301`) มีสถานะการครองห้อง (`OccupancyStatus`) และสถานะความสะอาด (`ConditionStatus`) | `Room`, `Apartment`, `Chamber`, `Space` |
| 6 | `StayMode` | รูปแบบการเข้าพัก | โหมดการคิดเวลาและราคา ประกอบด้วยค่าคงที่ 3 ค่าเท่านั้น: `Hourly`, `Daily`, `Monthly` | `RentalType`, `BookingType`, `StayType` |
| 7 | `Customer` | ลูกค้า / ผู้เช่า | บุคคลธรรมดาหรือนิติบุคคลที่เป็นผู้จอง ผู้เข้าพักหลัก หรือคู่สัญญาเช่ารายเดือน ผูกกับบัญชีฝั่ง `client` | `ClientUser`, `Member`, `GuestAccount`, `TenantProfile` |
| 8 | `Occupant` | ผู้พักอาศัย | บุคคลที่เข้าพักจริงในห้อง (รวมทั้งผู้เข้าพักหลักและผู้พักร่วม `CoOccupant`) ใช้สร้างรายงาน ร.ร.4 และ ตม.30 (TM.30) | `Visitor`, `Resident`, `Roommate` |
| 9 | `Reservation` | ใบจองห้องพัก | การจองล่วงหน้าสำหรับ `Hourly`, `Daily`, `Monthly` รองรับทั้งการล็อกโควตา `UnitType` และการล็อกเลข `Unit` พร้อมกลไก `HoldExpiresAt` (TTL) | `Booking`, `Order`, `PreStay` |
| 10 | `Stay` | การเข้าพัก (รายชั่วโมง/รายวัน) | รายการเข้าพักจริงตั้งแต่ `CheckInAt` จนถึง `CheckOutAt` สำหรับโหมด `Hourly` และ `Daily` | `Visit`, `CheckInRecord`, `OccupancySession` |
| 11 | `Folio` | บัญชีค่าใช้จ่ายประจำการเข้าพัก | กระเป๋ารายการค่าห้อง, ค่าต่อชั่วโมง/เกินเวลา, มินิบาร์, ค่าเสียหาย และการรับชำระระหว่างพักของ `Stay` หนึ่งรายการ | `Tab`, `StayBill`, `RoomAccount` |
| 12 | `Lease` | สัญญาเช่ารายเดือน | สัญญาเช่าระยะยาวสำหรับโหมด `Monthly` ระบุวันเริ่ม-สิ้นสุดสัญญา, เงินประกัน, ค่าเช่ารายเดือน และเลขมิเตอร์ตั้งต้นวันส่งมอบห้อง | `Contract`, `Agreement`, `Tenancy` |
| 13 | `MeterReading` | บันทึกเลขมิเตอร์ | รายการจดเลขมิเตอร์น้ำ (`Water`) และไฟ (`Electric`) ของแต่ละ `Unit` ประจำรอบบิล พร้อมเลขครั้งก่อน หน่วยที่ใช้ไป และรูปถ่ายมิเตอร์ | `UtilityLog`, `MeterUsage`, `GaugeRecord` |
| 14 | `Invoice` | ใบแจ้งหนี้ | เอกสารเรียกเก็บเงินอย่างเป็นทางการ (เกิดจาก `Folio` หรือจากรอบบิลรายเดือนของ `Lease`) รองรับการแยกประเภทภาษีรายบรรทัด | `Bill`, `Statement`, `DebitNote` |
| 15 | `Receipt` | ใบเสร็จรับเงิน / ใบกำกับภาษี | เอกสารยืนยันการรับชำระเงินที่ออกหลังรับเงินสดในกะแคชเชียร์หรือหลังอนุมัติสลิปโอนเงินแล้ว | `PaymentVoucher`, `Slip`, `PaidRecord` |
| 16 | `CashierShift` | กะแคชเชียร์ | รอบการทำงานของพนักงานรับ-จ่ายเงินหน้าเคาน์เตอร์ (เปิดกะพร้อมเงินทอนตั้งต้น → รับ/จ่ายเงิน → นับเงินปิดกะและกระทบยอด) | `DrawerSession`, `WorkShift`, `TillSession` |
| 17 | `DepositLedger` | ทะเบียนคุมเงินมัดจำ/เงินประกัน | บัญชีแยกประเภทสำหรับติดตามเงินมัดจำกุญแจ, เงินมัดจำจอง และเงินประกันสัญญาเช่า (รับ → หักค่าเสียหาย/ค่าน้ำไฟค้าง → คืนเงินสุทธิ) | `DepositHistory`, `EscrowLog`, `PledgeAccount` |
| 18 | `HousekeepingTask` | งานทำความสะอาดห้อง | ใบงานแม่บ้านที่ผูกกับการเปลี่ยน `Unit.ConditionStatus` (`Dirty` → `Cleaning` → `Inspecting` → `Clean`) | `CleaningJob`, `MaidTask`, `RoomTurnaround` |
| 19 | `WorkOrder` | ใบแจ้งซ่อม | รายการแจ้งซ่อมบำรุงจากฝั่ง `admin` หรือ `client` พร้อมสถานะการซ่อม รูปก่อน-หลังซ่อม และการคิดค่าใช้จ่ายผู้เช่า (ถ้ามี) | `MaintenanceTicket`, `RepairJob`, `IssueReport` |
| 20 | `Parcel` | พัสดุผู้เช่า | รายการพัสดุที่มาส่งหน้าเคาน์เตอร์สำหรับผู้เช่ารายเดือนในฝั่ง `client` พร้อมรูปถ่ายกล่องและบันทึกการรับพัสดุ | `Package`, `Delivery`, `MailItem` |

---

## 3. มาตรฐานรหัสเอกสาร 9 หมวด (Document Numbering Standard)

เอกสารทางการค้าและปฏิบัติการทุกใบต้องใช้ `DocumentNumberService` ที่รันเลขแบบ Atomic ต่อ `Property` และรอบปี-เดือน (`INSERT ... ON CONFLICT DO UPDATE RETURNING` บนตาราง `DocumentSequence`)

**รูปแบบมาตรฐาน:** `{PROP}-{DOC}-{YY}{MM}-{SEQ:4}` (ตัวอย่าง: `BKK01-INV-2611-0042`)

| รหัส (`{DOC}`) | ชื่อเอกสาร (Entity) | ความหมาย | การรีเซ็ตลำดับ (`{SEQ:4}`) |
|---|---|---|---|
| `RES` | `Reservation` | ใบจองห้องพัก (รายชั่วโมง / รายวัน / รายเดือน) | รายเดือนต่อ `Property` |
| `STY` | `Stay` | รายการเข้าพักจริง (`Hourly` / `Daily`) | รายเดือนต่อ `Property` |
| `LSE` | `Lease` | สัญญาเช่ารายเดือน (`Monthly`) | รายเดือนต่อ `Property` |
| `INV` | `Invoice` | ใบแจ้งหนี้ (ทั้งจาก `Folio` และรอบบิลรายเดือน) | รายเดือนต่อ `Property` |
| `RCT` | `Receipt` | ใบเสร็จรับเงิน / ใบกำกับภาษี | รายเดือนต่อ `Property` |
| `DEP` | `DepositTransaction` (ใน `DepositLedger`) | ใบรับเงินมัดจำ / ใบคืนเงินประกันสัญญา | รายเดือนต่อ `Property` |
| `SHF` | `CashierShift` | รอบกะแคชเชียร์หน้าเคาน์เตอร์ | รายเดือนต่อ `Property` |
| `WKO` | `WorkOrder` | ใบแจ้งซ่อมบำรุง | รายเดือนต่อ `Property` |
| `PCL` | `Parcel` | รายการรับพัสดุผู้เช่า | รายเดือนต่อ `Property` |

---

## 4. ตารางสถานะและกฎการเปลี่ยนสถานะ (State Machines)

| # | เอนทิตี / เอกสาร | สถานะที่เป็นไปได้ (Valid States) | กฎเหล็กในการเปลี่ยนสถานะ (Transition Invariants) |
|---|---|---|---|
| 1 | `Unit.OccupancyStatus` | `Vacant`, `Occupied`, `Reserved`, `Blocked` | เปลี่ยนเป็น `Occupied` เมื่อมี `Stay.Status == Active` หรือ `Lease.Status IN (Active, MoveOutNotice)`; เปลี่ยนเป็น `Blocked` เมื่อมีใบงานซ่อมหนัก |
| 2 | `Unit.ConditionStatus` | `Clean`, `Dirty`, `Cleaning`, `Inspecting`, `OutOfOrder` | เมื่อ `Stay` ทำรายการ `CheckOut` หรือ `Lease` ทำรายการ `MovedOut` ระบบเปลี่ยนเป็น `Dirty` และสร้าง `HousekeepingTask` อัตโนมัติ; **ห้าม Check-in เข้าห้องที่ไม่ใช่ `Clean`** เว้นแต่มีสิทธิ์ `admin.stay.override_dirty_checkin` พร้อมระบุเหตุผลลง `AuditEvent` |
| 3 | `Reservation` | `Hold`, `PendingVerification`, `Confirmed`, `CheckedIn`, `Expired`, `Cancelled`, `NoShow` | จองออนไลน์ผ่าน `client` เริ่มที่ `Hold` (ล็อกโควตาตาม `HoldExpiresAt` ค่าเริ่มต้น 15 นาที) → เมื่อแนบสลิปเปลี่ยนเป็น `PendingVerification` → เมื่อ `admin` อนุมัติสลิปเปลี่ยนเป็น `Confirmed` → เมื่อเข้าพักจริงเปลี่ยนเป็น `CheckedIn`; หากหมดเวลา `HoldExpiresAt` โดยยังไม่แนบสลิปจะกลายเป็น `Expired` และคืนโควตาอัตโนมัติ |
| 4 | `Stay` | `Active`, `CheckedOut`, `Cancelled` | เมื่อเปลี่ยนเป็น `CheckedOut` ยอดค้างใน `Folio` ต้องเท่ากับ `0.00` และต้องบันทึกการคืนหรือหักเงินมัดจำกุญแจใน `DepositLedger` ให้ครบถ้วน |
| 5 | `Lease` | `Draft`, `PendingSignature`, `Active`, `MoveOutNotice`, `MovedOut`, `Terminated`, `Cancelled` | ยูนิตที่มี `Lease` สถานะ `Active` หรือ `MoveOutNotice` จะถูกบล็อกใน `tstzrange` ไม่ให้รับจองหรือเปิดห้อง `Hourly` / `Daily` ตลอดช่วงสัญญา |
| 6 | `Invoice` | `Draft`, `Issued`, `PartiallyPaid`, `Paid`, `Overdue`, `Voided` | **ห้ามลบ (`DELETE`) ใบแจ้งหนี้ที่อยู่ในสถานะ `Issued` ขึ้นไปเด็ดขาด** หากออกผิดต้องทำรายการ `Voided` พร้อมระบุเหตุผล บันทึกลง `AuditEvent` แล้วจึงออกใบใหม่ |
| 7 | `CashierShift` | `Open`, `Closed`, `Reconciled` | พนักงานฝั่ง `admin` ที่ทำรายการรับ/คืนเงินสดต้องมี `CashierShift` สถานะ `Open` ของตนเองใน `Property` นั้น; ตอนปิดกะ (`Closed`) ต้องบันทึกยอดเงินสดนับจริง (`ActualCashCounted`) เพื่อคำนวณ `CashVariance` |

---

## 5. กฎเหล็กทางธุรกิจที่ห้ามละเมิด (Core Domain Invariants)

1. **Zero Double-Booking Across All StayModes:**
   การจองแบบระบุเลขห้อง (`UnitId`), การเปิด `Stay` (`Hourly`/`Daily` รวมเวลา `TurnaroundBufferMinutes`) และสัญญาเช่า `Lease` (`Monthly`) ต้องเก็บช่วงเวลาเป็น `tstzrange` ใน PostgreSQL และบังคับด้วย `EXCLUDE USING gist` เพื่อป้องกันเวลาทับซ้อนในระดับฐานข้อมูล 100%
2. **Quota vs. Unit Lock Separation:**
   การจองออนไลน์ผ่าน `client` แบบโควตา `UnitType` ต้องตรวจสอบจำนวนห้องว่างสุทธิของ `UnitType` นั้นในช่วงเวลาที่ขอจอง (หักห้องที่ติด `Lease`, `Stay`, `Reservation` ที่ล็อก `Unit`, โควตา `Confirmed`/`PendingVerification` และ `Hold` ที่ยังไม่หมดอายุ) โดยล็อกแถว `UnitType` ขณะตัดโควตา
3. **Deposit Ledger Isolation:**
   เงินมัดจำกุญแจ, เงินมัดจำจอง และเงินประกันสัญญาเช่าถือเป็นหนี้สินหมุนเวียน/เงินรับฝาก ต้องบันทึกใน `DepositLedger` แยกจากรายได้ค่าห้อง (`Invoice` / `Folio` Revenue) และจะรับรู้เป็นรายได้เฉพาะส่วนที่ถูกหักชำระค่าเสียหายหรือถูกริบตามเงื่อนไขสัญญาเท่านั้น
4. **Line-Level Thai Tax Integrity:**
   ใบแจ้งหนี้ (`Invoice`) หนึ่งใบในธุรกิจอพาร์ตเมนต์และโรงแรมไทยอาจมีรายการที่มีสถานะภาษีต่างกัน (เช่น ค่าเช่าห้องรายเดือนเป็น `Exempt`, ค่าเช่าเฟอร์นิเจอร์/ค่าน้ำ-ไฟ/ค่าห้องรายวันเป็น `VatIncluded` หรือ `VatExcluded` 7%, และการรับชำระจากนิติบุคคลมี `WithholdingTax` 5%) ดังนั้นทุกบรรทัด (`InvoiceLine`) ต้องเก็บ `TaxMode`, `VatRate`, `VatAmount` และ `NetAmount` แยกกันอย่างชัดเจน
5. **High-Risk Action Auditability:**
   การแก้ไขเลขมิเตอร์หลังจากออก `Invoice` แล้ว, การ `Void` ใบแจ้งหนี้/ใบเสร็จ, การ Override เปิดห้องที่สถานะ `Dirty` และการคืนเงินประกันสัญญา ต้องบังคับส่ง `reason` จาก UI และบันทึกลงตาราง `AuditEvent` พร้อมค่าก่อน-หลังแก้ไขทุกครั้ง

---

## 6. เอกสารที่เกี่ยวข้อง (Related Authoritative Documents)

- กฎการทำงานและสถาปัตยกรรมโค้ด: [AGENTS.md](./AGENTS.md)
- มาตรฐานการออกแบบ UI/UX และ Ollama Design System: [design.md](./design.md)
- แผนที่เอกสารทั้งหมดของระบบ: [docs/README.md](./docs/README.md)
