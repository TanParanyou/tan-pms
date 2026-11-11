# ADR-0006: การสร้างเอกสาร PDF ด้วย QuestPDF (Community License) และฟอนต์ Sarabun ฝังในโปรแกรม

## Status

Accepted — 2026-11-08

## Context

ต้องออกเอกสารพิมพ์ได้ 2 ชนิดจาก Backend: สัญญาเช่ารายเดือน (`Lease` Contract) และใบเสร็จรับเงิน (`Receipt`, รวมใบเสร็จจากการชำระ `Folio` ของ `Stay`) เป็นภาษาไทยที่แสดงสระ/วรรณยุกต์ถูกต้องบนเครื่องใดก็ได้ โดยไม่พึ่งฟอนต์ที่ติดตั้งบนเซิร์ฟเวอร์ และไม่พึ่งบริการภายนอก (ข้อมูลมี PII)

## Decision

1. **ใช้ QuestPDF** (`QuestPdfDocumentRenderer` ใน `TanPms.Infrastructure/Pdf/`) เป็น Implementation ของ Interface ใน Application เพื่อให้ Handler/Domain ไม่ผูกกับไลบรารี (ตาม [ADR-0001](./0001-clean-architecture-and-stack.md))
2. **ตั้ง `QuestPDF.Settings.License = LicenseType.Community`** ในโค้ด ต้องทบทวนเงื่อนไขทางธุรกิจของ Community License (ปัจจุบันอนุญาตฟรีสำหรับองค์กรที่รายได้ต่อปีไม่เกินเพดานที่ QuestPDF กำหนด) ทุกครั้งที่ปรับเวอร์ชันหรือเมื่อองค์กรเติบโต — หากเกินเงื่อนไขต้องซื้อ Professional/Enterprise License
3. **ฝังฟอนต์ Sarabun** (`Regular` + `Bold`) เป็น Embedded Resource ที่ `Pdf/Fonts/` พร้อมไฟล์ `OFL.txt` ใช้ลงทะเบียนกับ QuestPDF ตอนเริ่มทำงาน
4. **Attribution ตาม SIL Open Font License 1.1:** ลิขสิทธิ์ "Copyright 2018 The Sarabun Project Authors" และข้อความ OFL เก็บไว้ในซอร์สที่ `backend/src/TanPms.Infrastructure/Pdf/Fonts/OFL.txt` (ไม่พิมพ์ลงบนเอกสาร); ห้ามขายฟอนต์แยกเดี่ยว และหากแก้ไขฟอนต์ต้องเปลี่ยนชื่อตามเงื่อนไข OFL
5. **Endpoint** ตอบ `application/pdf` ผ่าน `Results.File` (`/leases/{leaseId}/contract.pdf` ฝั่ง `admin`, `/receipts/{receiptId}/pdf` ทั้ง 2 ฝั่ง) โดยตรวจสิทธิ์และ Scope ก่อน Render เสมอ ดูรายละเอียดใน [api-conventions.md](../03-contracts/api-conventions.md)

## Consequences

- **ข้อดี:** Render ในโปรเซสเดียว ไม่ต้องมี Headless Browser/บริการภายนอก, ผลลัพธ์ภาษาไทยเหมือนกันทุกสภาพแวดล้อม, Fluent API ทดสอบได้ (`FilesPdfAndCashBindingTests`)
- **ข้อจำกัด:** ขนาด Assembly/ฟอนต์เพิ่ม; ความเสี่ยงด้านลิขสิทธิ์ถ้าองค์กรพ้นเงื่อนไข Community; Layout เอกสารเป็นโค้ด C# ไม่ใช่เทมเพลตที่ธุรกิจแก้เองได้; ยังไม่มีลายเซ็นดิจิทัลหรือ PDF/A
- **ข้อควรตรวจก่อน Production:** ผ่านการตรวจเอกสารกับฝ่ายบัญชี/กฎหมายสำหรับรูปแบบใบเสร็จและสัญญาจริง

## Alternatives Considered

- **Headless Chromium (Puppeteer/Playwright) แปลง HTML:** ยืดหยุ่นด้านดีไซน์แต่หนักและเพิ่ม Dependency ระบบ — ปฏิเสธ
- **iText / PDFsharp / wkhtmltopdf:** ติด License แบบ AGPL/ความเสี่ยงหรือรองรับไทยยากกว่า — ปฏิเสธ
- **Render ฝั่ง Frontend (`window.print`/jsPDF):** ควบคุมเนื้อหา/สิทธิ์ยาก และฟอนต์ไทยไม่คงที่ — ปฏิเสธ
- **ใช้ฟอนต์ระบบปฏิบัติการ:** ผลต่างกันตามเครื่อง/ไม่มีบน Container — ปฏิเสธ
