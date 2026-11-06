# Frontend Architecture (`Next.js App Router` & Ollama Design System) — `tan-pms`

เอกสารนี้กำหนดโครงสร้างโฟลเดอร์ กฎการจัดการสถานะ และมาตรฐานคอมโพเนนต์ของฝั่ง Frontend (`frontend/`) สำหรับ **`tan-pms`**

> อ้างอิงกฎการออกแบบและโทเค็นสี/รูปทรงจาก [design.md](../../design.md) และการตัดสินใจจาก [0003-ollama-design-system-and-shadcn.md](../adr/0003-ollama-design-system-and-shadcn.md)

---

## 1. โครงสร้างโฟลเดอร์และ Route Groups (`(auth)`, `(admin)`, `(client)`)

```text
frontend/
├── package.json
└── src/
    ├── app/
    │   ├── (auth)/                  # หน้าเข้าสู่ระบบ (/login, /client/login)
    │   ├── (admin)/                 # ระบบปฏิบัติการฝั่งพนักงานและผู้บริหาร (/admin/...)
    │   │   └── admin/
    │   │       ├── rack/            # Unified Room Rack & Walk-in Desk (PM-04, PM-05)
    │   │       ├── reservations/    # จัดการใบจองและจัดสรรเลขห้อง (PM-04)
    │   │       ├── leases/          # สัญญาเช่ารายเดือน ทะเบียนผู้พักร่วม/รถยนต์ (PM-06)
    │   │       ├── meters/          # ตารางจดมิเตอร์น้ำ-ไฟยกตึก & Batch Billing (PM-07)
    │   │       ├── cashier/         # กะแคชเชียร์ คิวตรวจสลิป & Deposit Ledger (PM-08)
    │   │       ├── operations/      # กระดานแม่บ้าน ใบแจ้งซ่อม & รับพัสดุ (PM-09)
    │   │       ├── properties/      # ตั้งค่าสาขา อาคาร ห้องพัก และเรตราคา (PM-02, PM-03)
    │   │       └── analytics/       # รายงานผู้บริหาร Occupancy, RevPAR, Aging (PM-10)
    │   └── (client)/                # ระบบบริการตนเองฝั่งลูกค้าและผู้เช่า (/client/...)
    │       └── client/
    │           ├── book/            # จองห้องออนไลน์พร้อม Countdown Hold TTL 15 นาที (PM-04, PM-10)
    │           ├── dashboard/       # สรุปสัญญา บิลค้างชำระ แจ้งซ่อม และพัสดุรอรับ (PM-10)
    │           ├── invoices/        # ดูใบแจ้งหนี้ กราฟน้ำ-ไฟ แนบสลิป และโหลดใบเสร็จ PDF (PM-08, PM-10)
    │           ├── work-orders/     # แจ้งซ่อมพร้อมรูปถ่ายและติดตามสถานะ (PM-09, PM-10)
    │           └── parcels/         # รายการพัสดุที่มาส่งหน้าเคาน์เตอร์ (PM-09, PM-10)
    ├── components/
    │   ├── ui/                      # Central shadcn/ui primitives ปรับแต่งตาม Ollama Design System
    │   └── shared/                  # FormTabs, TerminalCard, PropertySwitcherPill, DeferredFilePicker
    ├── features/                    # โลจิกแยกตามโมดูล (api hooks, zod schemas, columns, forms)
    ├── generated/
    │   └── api/                     # TypeScript types ที่สร้างอัตโนมัติจาก contracts/openapi/tan-pms.v1.json
    ├── hooks/                       # useDeferredFileUpload, useFormTabErrors, useCountdownTimer
    ├── lib/                         # api-client.ts, problem-details.ts, formatters.ts
    └── messages/
        ├── th.json                  # ข้อความภาษาไทย (Default Locale)
        └── en.json                  # ข้อความภาษาอังกฤษ (100% Key Parity)
```

---

## 2. กฎเหล็กทางวิศวกรรมฝั่ง Frontend

1. **OpenAPI Type Safety (`No Manual DTO Guessing`):**
   - ทุก Request/Response Type ต้องอ้างอิงจาก `src/generated/api/schema.d.ts` ที่สร้างจาก `contracts/openapi/tan-pms.v1.json` ห้ามประกาศ Interface ของ API ซ้ำเองหรือใช้ `any`
2. **Ollama Minimal Design System via `shadcn/ui`:**
   - ใช้เฉพาะคอมโพเนนต์จาก `src/components/ui/` ที่ตั้งค่าตาม [design.md](../../design.md): พื้นขาว `#ffffff`, สีหลัก `#000000`, ปุ่มและช่องกรอกทรงแคปซูล `9999px` (`rounded-full`), การ์ดขอบบาง `12px` (`1px solid #e5e5e5`) และมี `.inverted-card` (`#171717`) ได้เพียง **1 จุดต่อหน้า**
3. **Standard Enterprise Hooks (`FormTabs` & `useDeferredFileUpload`):**
   - ฟอร์มหลายแท็บต้องใช้ `FormTabs` ร่วมกับ `useFormTabErrors` เพื่อแสดงจุดแดงบนแท็บที่มี Validation Error
   - การแนบสลิปโอนเงิน รูปมิเตอร์ รูปบัตรประชาชน รูปแจ้งซ่อม และรูปพัสดุ ต้องผ่าน `useDeferredFileUpload` เพื่ออัปโหลดไฟล์จริงเฉพาะเมื่อกดบันทึกฟอร์มสำเร็จเท่านั้น
4. **No Client-Side Foreign Key `.find()`:**
   - ตารางและรายละเอียดต้องแสดงค่าจากฟิลด์ที่ Backend ส่งมาให้พร้อมใช้ (เช่น `row.unit.unitNumber`, `row.customer.fullName`) ห้ามดึงรายการห้องทั้งหมดหรือลูกค้าทั้งหมดมา `.find()` บนเบราว์เซอร์
5. **100% Localization (`th` / `en`) & Problem Details Mapping:**
   - ทุกข้อความบนหน้าจอต้องดึงผ่าน `useTranslations()` และทุก `errorCode` จาก RFC 9457 Problem Details ต้องแปลงเป็นข้อความแจ้งเตือนตามภาษาที่ผู้ใช้เลือก
