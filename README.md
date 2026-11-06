# `tan-pms` — Enterprise Property Management System

ระบบบริหารจัดการที่พักและอสังหาริมทรัพย์ให้เช่าระดับองค์กรสำหรับ **องค์กรเดียวที่มีหลายสาขาและหลายอาคาร (Single-Organization, Multi-Property/Multi-Building)** ที่รวมการบริหารห้องพักทั้ง **3 รูปแบบ (`StayMode`)** ไว้ในแพลตฟอร์มเดียว:
- **`Hourly` (รายชั่วโมง):** เปิดห้องด่วนหน้าเคาน์เตอร์, แพ็กเกจชั่วโมงเริ่มต้น + ชั่วโมงถัดไป, ตัวจับเวลาสด, ปัดเพดานเป็นรายวันอัตโนมัติ (`AutoCapToDailyRate`) และเผื่อเวลาแม่บ้าน (`TurnaroundBufferMinutes`)
- **`Daily` (รายวัน):** จองตามโควตา `UnitType` หรือระบุ `Unit`, บัญชีค่าใช้จ่ายประจำห้อง (`Folio`), เงินมัดจำกุญแจ และรายงานผู้เข้าพัก ร.ร.4 / ตม.30 (TM.30)
- **`Monthly` (รายเดือน):** สัญญาเช่าระยะยาว (`Lease`), เงินประกันสัญญา (`DepositLedger`), ตารางจดมิเตอร์น้ำ-ไฟยกตึก (`MeterReading`), ออกใบแจ้งหนี้รายเดือนยกตึก (`Batch Invoice Run`), ทะเบียนผู้พักร่วม/รถยนต์ และการจัดการพัสดุ (`Parcel`)

---

## 1. เอกสารสำคัญที่ต้องอ่านก่อนเริ่มงาน (Start Here)

1. **[AGENTS.md](./AGENTS.md)** — กฎเหล็กสำหรับการพัฒนาและ AI Agent (`.NET 10` + `Next.js` + `PostgreSQL`, การแยก `(admin)` / `(client)`)
2. **[CONTEXT.md](./CONTEXT.md)** — พจนานุกรมคำศัพท์โดเมน 20 คำหลัก, รหัสเอกสาร 9 หมวด (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`) และ State Machines
3. **[design.md](./design.md) (`DESIGN.md`)** — มาตรฐานการออกแบบ **Ollama Minimal Design System** (`#000000` บน `#ffffff`, รูปทรงแคปซูล `9999px`, การ์ดขอบบาง `12px`, การ์ดสีเข้ม `#171717` เพียง 1 จุดต่อหน้า) ร่วมกับ `Tailwind CSS` + `shadcn/ui`
4. **[docs/README.md](./docs/README.md)** — สารบัญและแผนที่เอกสารสถาปัตยกรรมทั้งหมด (`00-overview` ถึง `06-operations` และ `adr`)
5. **[preview.html](./preview.html)** — ต้นแบบหน้าจอ Interactive UI/UX Mockup ทั้งฝั่ง `(admin)` และ `(client)`

---

## 2. การตรวจสอบความถูกต้องของเอกสารและธรรมาภิบาล

รันคำสั่งต่อไปนี้เพื่อตรวจสอบความครบถ้วนของไฟล์เอกสาร คำศัพท์ รหัสเอกสาร โมดูล `PM-01`–`PM-10` และลิงก์ภายในทั้งหมด:

```bash
npm run verify:docs
```
