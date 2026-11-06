# Definition of Done (DoD) — `tan-pms`

เอกสารนี้คือรายการตรวจสอบที่ทุกฟีเจอร์และทุก Vertical Slice (`PM-01` ถึง `PM-10`) ของ **`tan-pms`** ต้องผ่านครบก่อนทำการ Merge เข้าสู่สาขาหลัก

> อ้างอิงกลยุทธ์การทดสอบจาก [testing-strategy.md](./testing-strategy.md) และมาตรฐาน UI จาก [design.md](../../design.md)

---

## 1. เกณฑ์ด้านสถาปัตยกรรมและคุณภาพโค้ด (Code & Architecture)
- [ ] ใช้คำศัพท์ตรงตาม [CONTEXT.md](../../CONTEXT.md) 100% (ไม่มีคำต้องห้าม เช่น `Staff`, `Portal`, `RoomType`, `Booking`, `Contract`)
- [ ] ผ่าน `dotnet build -warnaserror` และ `ArchUnitNET` โดยไม่มี Warning หรือการอ้างอิงข้ามชั้นโปรเจกต์
- [ ] อัปเดต `contracts/openapi/tan-pms.v1.json` และซิงก์ TypeScript Types ใน `frontend/src/generated/api/` เรียบร้อย
- [ ] ไม่มี `any`, `@ts-ignore`, หรือ `array.find()` เพื่อจับคู่ Foreign Key บนฝั่ง Frontend

## 2. เกณฑ์ด้านความปลอดภัยและข้อมูล (Security, Scope & Data Integrity)
- [ ] ทุก Endpoint ฝั่ง `/api/v1/admin/...` บังคับตรวจ `AdminScope` (`AllowedPropertyIds` + Permission Key) และฝั่ง `/api/v1/client/...` บังคับตรวจ `ClientScope` (`CustomerId`)
- [ ] ข้อมูลเลขบัตรประชาชนและหนังสือเดินทางถูกเข้ารหัสและส่งออกในรูปแบบ Masking (`1-xxxx-xxxxx-12-3`) เป็นค่าเริ่มต้น
- [ ] การกระทำที่มีความเสี่ยงสูง (เช่น `Void` บิล, แก้เลขมิเตอร์หลังออกบิล, คืนเงินประกัน, Override ห้อง `Dirty`) บังคับกรอกเหตุผลและบันทึกลงตาราง `AuditEvent`

## 3. เกณฑ์ด้าน UI/UX และภาษา (Ollama Design System & i18n)
- [ ] ใช้คอมโพเนนต์จาก `frontend/src/components/ui/` ตามระบบ **Ollama Minimal Design System** (`#000000` บน `#ffffff`, ปุ่ม/ช่องกรอกทรงแคปซูล `9999px`, การ์ดขอบบาง `12px`, และมี `.inverted-card` `#171717` ไม่เกิน 1 จุดต่อหน้า)
- [ ] ฟอร์มหลายแท็บใช้ `FormTabs` (แสดงจุดแดงเมื่อแท็บมี Error) และการอัปโหลดไฟล์ใช้ `useDeferredFileUpload`
- [ ] ข้อความทั้งหมดดึงจาก `messages/th.json` และ `messages/en.json` ครบทั้งสองภาษา
- [ ] ผ่านการตรวจ `impeccable detect` โดยไม่มีปัญหา Contrast ต่ำหรือ Nested Bordered Cards

## 4. เกณฑ์ด้านการทดสอบและเอกสาร (Verification & Docs)
- [ ] มี Unit Test และ Integration Test (`Testcontainers.PostgreSql`) ครอบคลุมทั้งกรณีสำเร็จและกรณีเกิดข้อผิดพลาด (RFC 9457 `errorCode`)
- [ ] รัน `npm run verify:docs` และชุดทดสอบทั้งหมดผ่านด้วยผลลัพธ์สีเขียวสดใหม่จาก Terminal
