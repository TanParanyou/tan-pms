---
version: alpha
name: Ollama (tan-pms Design System)
website: "https://ollama.com"
description: |
  An almost defiantly minimal documentation-first system that treats the home page like a Markdown README — paper-white canvas, 36px center-aligned heading, a single black pill CTA, an inline terminal install snippet, and a hand-drawn mascot/emblem as the only ornamental element. No gradient, no hero photography, no marketing pyrotechnics. The chrome is a tiny utility palette of pure black, pure white, and three neutral grays; every interactive element is fully rounded into a pill (`{rounded.full}`); typography is SF Pro Rounded for headings paired with system sans for body and ui-monospace for code. Pricing tiers, FAQs, and operational tables all sit on the same flat canvas inside thin-border cards — the system is the documentation, and the documentation is the system.

colors:
  primary: "#000000"
  on-primary: "#ffffff"
  ink: "#000000"
  ink-deep: "#090909"
  charcoal: "#525252"
  body: "#737373"
  mute: "#a3a3a3"
  canvas: "#ffffff"
  surface-soft: "#fafafa"
  surface-card: "#ffffff"
  hairline: "#e5e5e5"
  hairline-strong: "#d4d4d4"
  on-dark: "#ffffff"
  on-dark-mute: "rgba(255,255,255,0.7)"
  surface-dark: "#171717"
  focus-ring: "rgba(59,130,246,0.5)"
  link: "#000000"
  link-mute: "#737373"
  terminal-red: "#ff5f56"
  terminal-yellow: "#ffbd2e"
  terminal-green: "#27c93f"

typography:
  display-xl:
    fontFamily: SF Pro Rounded
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.11
    letterSpacing: 0
  display-lg:
    fontFamily: SF Pro Rounded
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  heading-lg:
    fontFamily: SF Pro Rounded
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: 0
  heading-md:
    fontFamily: ui-sans-serif
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  heading-sm:
    fontFamily: ui-sans-serif
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.56
    letterSpacing: 0
  body-md:
    fontFamily: ui-sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-strong:
    fontFamily: ui-sans-serif
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: ui-sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  body-sm-strong:
    fontFamily: ui-sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0
  caption-sm:
    fontFamily: ui-sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  code-md:
    fontFamily: ui-monospace
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  code-sm:
    fontFamily: ui-monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  button-md:
    fontFamily: ui-sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0

rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 88px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 8px 20px
    height: 36px
  button-primary-active:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 8px 20px
    height: 36px
  button-pill-on-dark:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 8px 20px
  button-disabled:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.mute}"
    rounded: "{rounded.full}"
  search-pill:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 36px
  search-pill-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 40px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  install-snippet:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.code-md}"
    rounded: "{rounded.full}"
    padding: 12px 20px
    height: 48px
  command-tag:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  terminal-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  terminal-traffic-lights:
    rounded: "{rounded.full}"
    size: 12px
  pricing-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 32px
  pricing-card-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 32px
  feature-bullet:
    textColor: "{colors.charcoal}"
    typography: "{typography.body-sm}"
  faq-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 16px 0px
  link-inline:
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
  link-mute:
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
  primary-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.none}"
    height: 56px
  footer-section:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.caption-sm}"
    rounded: "{rounded.none}"
    padding: 32px 24px
  cta-strip-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.heading-lg}"
    rounded: "{rounded.lg}"
    padding: 24px 32px
---


# design.md — มาตรฐานการออกแบบ UI/UX และสถาปัตยกรรมคอมโพเนนต์ (`tan-pms`)

เอกสารนี้คือ **Single Source of Truth** ด้านการออกแบบ UI/UX, ระบบโทเค็นสี/ฟอนต์/รูปทรง และกฎการสร้างคอมโพเนนต์ของ **`tan-pms`** โดยผสาน **Ollama Minimal Design System** (ตาม YAML Frontmatter ด้านบน) เข้ากับ **`Tailwind CSS` + `shadcn/ui`** และมาตรฐานฟอร์ม/ตารางระดับ Enterprise สำหรับทั้งฝั่ง **`(admin)`** และ **`(client)`**

---

## 1. ปรัชญาการออกแบบ (Design Philosophy: Documentation-First Restraint)

1. **Two-Color Chrome & Paper-White Canvas:**
   - พื้นหลังหลักของหน้าจอและการ์ดคือสีขาวบริสุทธิ์ `#ffffff` (`{colors.canvas}`) สลับกับพื้นผิวรองสีเทาอ่อนจัด `#fafafa` (`{colors.surface-soft}`)
   - สีหลักของปุ่มและจุดเน้นทั้งหมดคือสีดำบริสุทธิ์ `#000000` (`{colors.primary}`) และสถานะกด `#090909` (`{colors.ink-deep}`)
   - ห้ามใช้สีน้ำเงินเข้มเดิมหรือสีตกแต่งนอกระบบโทเค็น
2. **Pill Geometry Everywhere (`9999px`) & Hairline Cards (`12px`):**
   - ทุกองค์ประกอบที่โต้ตอบได้ (Buttons, Inputs, Selects, Search Bars, Filter Chips, Command Tags, Status Pills) **ต้อง** ใช้มุมโค้งแคปซูล `9999px` (`rounded-full` / `{rounded.full}`)
   - การ์ดข้อมูล, ตาราง, โมดอล และกล่อง Terminal ใช้มุมโค้ง `12px` (`rounded-lg` / `{rounded.lg}`) พร้อมเส้นขอบบาง `1px solid #e5e5e5` (`{colors.hairline}`) หรือ `#d4d4d4` (`{colors.hairline-strong}`)
3. **Single Inverted Dark Surface per Page (`#171717`):**
   - ใน 1 หน้าจออนุญาตให้มีการ์ดพื้นหลังสีดำเข้ม `#171717` (`{colors.surface-dark}`) ได้ไม่เกิน **1 จุดเท่านั้น** เพื่อดึงสายตาไปยังส่วนที่สำคัญที่สุดของหน้านั้น (เช่น การ์ด **Cashier Shift & Active Stay Drawer** ในฝั่ง `(admin)` หรือการ์ด **Booking Hold Countdown / Active Invoice Summary** ในฝั่ง `(client)`)
   - ข้อความหัวข้อ (`h1`, `h2`, `h3`) และตัวเลขภายใน `.inverted-card` ต้องบังคับเป็นสีขาว `#ffffff` (`{colors.on-dark}`) และข้อความรองเป็น `rgba(255,255,255,0.7)` (`{colors.on-dark-mute}`) เพื่อรักษามาตรฐาน Contrast ระดับ AAA
4. **CLI & Terminal Card Aesthetics:**
   - ข้อมูลเชิงปฏิบัติการ เช่น คิวตรวจสลิป, บันทึกกะแคชเชียร์, รหัสเอกสาร (`BKK01-INV-2611-0042`) และสถานะห้องพักรายชั่วโมง แสดงผลด้วยฟอนต์ `ui-monospace` ภายใน `terminal-card` ที่มีจุดไฟจราจร 3 สี (`#ff5f56`, `#ffbd2e`, `#27c93f` ขนาด `12px` `rounded-full`)

---

## 2. ระบบฟอนต์และลำดับชั้นข้อความ (Typography Scale)

- **Display & Headings (`SF Pro Rounded`):**
  - ใช้ `'SF Pro Rounded', -apple-system, BlinkMacSystemFont, 'Nunito', sans-serif` สำหรับหัวข้อระดับ `display-xl` (`36px/500`), `display-lg` (`30px/500`) และ `heading-lg` (`24px/600`)
- **UI Body & Labels (`ui-sans-serif`):**
  - ใช้ `ui-sans-serif, system-ui, -apple-system, 'Inter', 'Noto Sans Thai', sans-serif` สำหรับเนื้อหา ป้ายกำกับฟอร์ม และตาราง (`16px` สำหรับเนื้อหาหลัก, `14px` สำหรับตาราง/ปุ่ม, `12px` สำหรับ Caption)
- **Operational Codes, Timers & Amounts (`ui-monospace`):**
  - ใช้ `ui-monospace, SFMono-Regular, 'JetBrains Mono', monospace` พร้อม `font-variant-numeric: tabular-nums` สำหรับรหัสเอกสาร 9 หมวด (`RES`, `STY`, `LSE`, `INV`, `RCT`, `DEP`, `SHF`, `WKO`, `PCL`), เวลาถอยหลังรายชั่วโมง (`Hourly Timer`), เลขมิเตอร์น้ำ-ไฟ และจำนวนเงินทุกจุด

---

## 3. มาตรฐานการปรับแต่ง `shadcn/ui` และ Central UI Components

ห้ามเขียน `<input>`, `<select>`, `<textarea>`, `<button>` ดิบในหน้าฟีเจอร์ (`features/**` หรือ `app/**`) ต้องเรียกใช้ผ่านคอมโพเนนต์กลางใน `frontend/src/components/ui/` ที่ปรับแต่งตาม Ollama Design System แล้วเท่านั้น:

| คอมโพเนนต์ (`shadcn/ui`) | กฎการปรับแต่งสำหรับ `tan-pms` |
|---|---|
| `Button` | `rounded-full` (`9999px`) เสมอ; `variant="default"` ใช้พื้น `#000000` ตัวอักษร `#ffffff` สูง `36px` (`h-9 px-5`); `variant="outline"` ใช้พื้น `#ffffff` เส้นขอบ `#e5e5e5` ตัวอักษร `#000000` |
| `Input` / `SelectTrigger` | `rounded-full` (`9999px`) สูง `40px` (`h-10 px-4`) พื้น `#ffffff` เส้นขอบ `#e5e5e5` โฟกัสด้วยวงแหวน `rgba(59,130,246,0.5)` |
| `Card` | `rounded-[12px]` พื้น `#ffffff` เส้นขอบ `1px solid #e5e5e5` ไม่มีเงาฟุ้ง (`shadow-none`) ห้ามซ้อนการ์ดมีขอบไว้ในการ์ดมีขอบอีกชั้น (ให้ใช้เส้นคั่น `divide-y` หรือ `divide-x` `#e5e5e5` แทนเพื่อป้องกัน Nested Cards) |
| `Badge` / `CommandTag` | `rounded-full` (`9999px`) พื้น `#fafafa` เส้นขอบ `#e5e5e5` ฟอนต์ `ui-monospace` `12px`–`14px` |
| `Tabs` (`FormTabs`) | แถบสลับแท็บทรงแคปซูล `rounded-full` พื้น `#fafafa` แท็บที่เลือกใช้พื้น `#000000` ตัวอักษร `#ffffff` พร้อมจุดกลมสีแดง `#ff5f56` แสดงทันทีเมื่อฟิลด์ภายในแท็บนั้นมี Validation Error |

---

## 4. กฎเหล็กด้าน UX/UI สำหรับฟอร์มและตาราง Enterprise (`tan-pms`)

1. **`FormTabs` Error Indicator & Auto-Focus:**
   ฟอร์มที่มีหลายแท็บ (เช่น ฟอร์มสร้างสัญญาเช่า `Lease` หรือฟอร์มตั้งค่า `Property` / `Unit`) ต้องใช้ `FormTabs` และ `useFormTabErrors` เมื่อกดบันทึกแล้วมีฟิลด์ไม่ผ่านการตรวจสอบ แท็บที่มีปัญหาต้องแสดงจุดสีแดง (`#ff5f56`) และระบบต้องสลับไปยังแท็บแรกที่มีข้อผิดพลาดพร้อมเลื่อนโฟกัสให้อัตโนมัติ
2. **Deferred File Upload (`useDeferredFileUpload`):**
   ทุกจุดที่อัปโหลดไฟล์ (สลิปโอนเงินใน `(client)`, รูปถ่ายมิเตอร์น้ำ-ไฟ, รูปบัตรประชาชนผู้เข้าพัก, รูปแจ้งซ่อม `WorkOrder`, รูปพัสดุ `Parcel`) **ห้าม** อัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์ทันทีที่ผู้ใช้เลือกไฟล์ ให้แสดงตัวอย่างไฟล์ในหน่วยความจำเครื่องก่อน และอัปโหลดจริงเฉพาะเมื่อผู้ใช้กดปุ่มบันทึกของฟอร์มเท่านั้น
3. **Zero-Layout-Shift Bulk Meter Table:**
   ตารางจดมิเตอร์น้ำ-ไฟ (`PM-07`) ต้องล็อกความกว้างคอลัมน์ (`table-fixed` + `tabular-nums`) เมื่อพนักงานพิมพ์เลขมิเตอร์ปัจจุบันแล้วระบบคำนวณหน่วยใช้ไป (`Usage = Current - Previous`) และยอดเงินแบบสด หรือแสดงป้ายเตือนความผิดปกติ (`Rollover` / `High Usage`) ตารางต้องไม่ขยับหรือกระตุกแม้แต่พิกเซลเดียว
4. **Top-Right Field Actions & Icon-First Adjacent Buttons:**
   - ปุ่มเสริมของฟิลด์ (เช่น ปุ่ม `"สร้างลูกค้าใหม่"` ข้างช่องเลือก `Customer` หรือปุ่ม `"คำนวณตามแพ็กเกจ"` ข้างช่องราคา) ต้องวางชิดขวาบนในบรรทัดเดียวกับ `<Label>` (`flex items-center justify-between`)
   - ปุ่มที่วางติดกับช่องกรอกในแนวนอนต้องใช้ไอคอนนำหน้าหรือเป็นปุ่มแคปซูลความสูงเท่ากับช่องกรอก (`40px`)
5. **Dual-Audience Layout Separation (`(admin)` vs `(client)`):**
   - ฝั่ง **`(admin)` (`/admin/...`):** ใช้เลย์เอาต์ความหนาแน่นสูงสำหรับปฏิบัติการ (Top Command Nav + Property Switcher Pill + Unified Room Rack + 1 Inverted Cashier Shift Card)
   - ฝั่ง **`(client)` (`/client/...`):** ใช้เลย์เอาต์โปร่ง สะอาด อ่านง่ายเหมือนเอกสาร README สำหรับผู้เช่าและผู้จองออนไลน์ (1 Inverted Booking Hold / Active Invoice Card + การ์ดบิล/มิเตอร์/แจ้งซ่อม/พัสดุทรง `12px`)

---

## 5. เอกสารที่เกี่ยวข้อง (Related Authoritative Documents)

- กฎเหล็กการทำงานของนักพัฒนาและ AI Agent: [AGENTS.md](./AGENTS.md)
- พจนานุกรมคำศัพท์และสถานะระบบ: [CONTEXT.md](./CONTEXT.md)
- แผนที่เอกสารทั้งหมดของระบบ: [docs/README.md](./docs/README.md)
