# Pricing, Utility Meter & Thai Tax Calculation Rules — `tan-pms`

เอกสารนี้คือข้อกำหนดมาตรฐานสำหรับการคำนวณราคาค่าห้องทั้ง 3 โหมด (`Hourly`, `Daily`, `Monthly`), การคิดค่าน้ำ-ค่าไฟจากมิเตอร์ (`MeterReading`), โครงสร้างภาษีไทยรายบรรทัด (`TaxProfile`) และการควบคุมกะแคชเชียร์/เงินประกัน

> คำศัพท์หลักทั้งหมดอ้างอิงจาก [CONTEXT.md](../../CONTEXT.md)

---

## 1. สูตรการคำนวณราคาห้องพักรายชั่วโมง (`HourlyStay` Pricing Formula)

การเข้าพักโหมด `Hourly` ใช้โครงสร้าง `HourlyRateRule` ที่ผูกกับแต่ละ `UnitType` และ `Property`:

### พารามิเตอร์มาตรฐาน
- `BasePackageHours`: จำนวนชั่วโมงในแพ็กเกจเริ่มต้น (เช่น `3` ชั่วโมง)
- `BasePackagePrice`: ราคาแพ็กเกจเริ่มต้น (เช่น `350.00` บาท)
- `AdditionalHourPrice`: ราคาต่อชั่วโมงถัดไป (เช่น `100.00` บาท/ชั่วโมง)
- `GracePeriodMinutes`: เวลาผ่อนผันหลังครบกำหนดก่อนเริ่มคิดชั่วโมงถัดไป (เช่น `15` นาที)
- `AutoCapToDailyRate`: เพดานราคาสูงสุดที่เมื่อคำนวณเกินแล้วระบบจะปัดเป็นราคารายวัน (`DailyRate`) อัตโนมัติ (เช่น `890.00` บาท)
- `TurnaroundBufferMinutes`: เวลาเผื่อทำความสะอาดที่ระบบบวกเพิ่มท้ายช่วงเวลาจองในฐานข้อมูล (เช่น `30` นาที) เพื่อไม่ให้ลูกค้าคนถัดไปจองชนเวลาแม่บ้านทำความสะอาด

### สูตรการคิดเวลาและยอดเงิน
กำหนดให้เวลาเข้าพักจริงเป็น $\Delta t$ (หน่วยนาที):
1. หาก $\Delta t \le (\text{BasePackageHours} \times 60) + \text{GracePeriodMinutes}$:
   $$\text{RawCharge} = \text{BasePackagePrice}$$
2. หาก $\Delta t > (\text{BasePackageHours} \times 60) + \text{GracePeriodMinutes}$:
   $$\text{ExtraHours} = \left\lceil \frac{\Delta t - (\text{BasePackageHours} \times 60) - \text{GracePeriodMinutes}}{60} \right\rceil$$
   $$\text{RawCharge} = \text{BasePackagePrice} + (\text{ExtraHours} \times \text{AdditionalHourPrice})$$
3. การปัดเพดานราคารายวัน (`AutoCapToDailyRate`):
   $$\text{FinalHourlyRoomCharge} = \min(\text{RawCharge}, \text{AutoCapToDailyRate})$$

---

## 2. สูตรการคำนวณค่าน้ำและค่าไฟ (`MeterReading` & `UtilityTariff`)

สำหรับการเช่ารายเดือน (`Monthly`), ระบบคำนวณหน่วยน้ำ (`Water`) และไฟ (`Electric`) จากการจดมิเตอร์แต่ละรอบบิล:

### 2.1 การคำนวณหน่วยที่ใช้ไป (`UsageUnits`) และการหมุนครบรอบ (`MeterRollover`)
- **กรณีปกติ ($\text{CurrentReading} \ge \text{PreviousReading}$):**
  $$\text{UsageUnits} = \text{CurrentReading} - \text{PreviousReading}$$
- **กรณีมิเตอร์หมุนครบรอบ ($\text{CurrentReading} < \text{PreviousReading}$):**
  ระบบจะไม่อนุญาตให้บันทึกโดยอัตโนมัติและจะส่งรหัส `meter.rollover_unconfirmed` จนกว่าพนักงานจะกดยืนยันว่ามิเตอร์หมุนครบรอบจริง (`IsRolloverConfirmed = true`) หรือเป็นเพราะเปลี่ยนมิเตอร์ใหม่ โดยเมื่อยืนยันครบรอบแล้วจะคำนวณตามจำนวนหลักของมิเตอร์ (`MeterMaxDigits` เช่น 4 หลัก = `10000`):
  $$\text{UsageUnits} = (10^{\text{MeterMaxDigits}} - \text{PreviousReading}) + \text{CurrentReading}$$

### 2.2 รูปแบบการคิดเงิน (`UtilityBillingMode`)
แต่ละ `Property` สามารถตั้งค่าวิธีคิดค่าน้ำและค่าไฟแยกกันได้ 3 รูปแบบ:
1. **`PerUnit` (คิดตามหน่วยจริงพร้อมขั้นต่ำ):**
   $$\text{Charge} = \max(\text{UsageUnits} \times \text{RatePerUnit}, \text{MinimumChargeAmount})$$
2. **`MinimumUnits` (เหมาจ่ายหน่วยขั้นต่ำ ส่วนเกินคิดตามหน่วย):**
   หาก $\text{UsageUnits} \le \text{IncludedUnits}$ คิดราคา $\text{BaseMinimumAmount}$; หากเกินคิด $\text{BaseMinimumAmount} + (\text{UsageUnits} - \text{IncludedUnits}) \times \text{RatePerUnit}$
3. **`FlatRate` (เหมาจ่ายรายเดือนคงที่):**
   คิดยอดคงที่ต่อห้องหรือต่อจำนวนผู้พักอาศัย (`Occupant`)

---

## 3. โครงสร้างภาษีไทยรายบรรทัด (`Line-Level Thai Tax Rules`)

เนื่องจากธุรกิจที่พักในประเทศไทยมีทั้งส่วนที่ได้รับยกเว้นภาษีมูลค่าเพิ่ม (เช่น ค่าเช่าอสังหาริมทรัพย์รายเดือน) และส่วนที่ต้องเสียภาษีมูลค่าเพิ่ม 7% (เช่น ค่าบริการรายวัน/รายชั่วโมง, ค่าเช่าเฟอร์นิเจอร์, ค่าบริการส่วนกลาง) ระบบจึงบังคับใช้ `TaxMode` ในระดับบรรทัดรายการ (`InvoiceLine`) แทนการคิดเหมารวมทั้งใบ:

| `TaxMode` | ความหมาย | สูตรคำนวณ (`VatRate = 7%`) | ตัวอย่างรายการที่ใช้ |
|---|---|---|---|
| `Exempt` | ยกเว้นภาษีมูลค่าเพิ่ม | $\text{SubTotal} = \text{LineAmount}$, $\text{VatAmount} = 0.00$, $\text{Total} = \text{LineAmount}$ | ค่าเช่าห้องพักตามสัญญารายเดือน (`Lease` Pure Room Rent) |
| `VatIncluded` | ราคาที่ตั้งรวม VAT 7% แล้ว | $\text{Total} = \text{LineAmount}$, $\text{SubTotal} = \text{round}(\text{Total} / 1.07, 2)$, $\text{VatAmount} = \text{Total} - \text{SubTotal}$ | ค่าห้องรายชั่วโมง (`Hourly`), ค่าห้องรายวัน (`Daily`), มินิบาร์ |
| `VatExcluded` | ราคาที่ตั้งยังไม่รวม VAT 7% | $\text{SubTotal} = \text{LineAmount}$, $\text{VatAmount} = \text{round}(\text{SubTotal} \times 0.07, 2)$, $\text{Total} = \text{SubTotal} + \text{VatAmount}$ | ค่าเช่าเฟอร์นิเจอร์รายเดือน, ค่าบริการนิติบุคคล |

### ภาษีหัก ณ ที่จ่าย (`WithholdingTax` — WHT)
- กรณีลูกค้าเป็นนิติบุคคลและมีการหักภาษี ณ ที่จ่าย (เช่น 5% สำหรับค่าเช่า หรือ 3% สำหรับค่าบริการ):
  - คำนวณ `WithholdingTaxAmount` จากยอดก่อนภาษีมูลค่าเพิ่ม ($\text{SubTotal} \times \text{WhtRate}$)
  - ยอดรับชำระสุทธิใน `Receipt` คือ $\text{NetPayable} = \text{InvoiceTotal} - \text{WithholdingTaxAmount}$ โดยต้องบันทึกเลขที่หนังสือรับรองการหักภาษี ณ ที่จ่าย (`WhtCertificateNumber`) ไว้กับ `Receipt`

---

## 4. กฎการปัดเศษและการคุมกะแคชเชียร์ (`Rounding`, `CashierShift` & `DepositLedger`)

1. **มาตรฐานทศนิยมและการปัดเศษ:** จำนวนเงินทุกฟิลด์เก็บด้วย `numeric(18,2)` ใน PostgreSQL และปัดเศษแบบ `MidpointRounding.AwayFromZero` (ทศนิยม 2 ตำแหน่ง) ในระดับบรรทัดรายการเสมอ
2. **สมการกระทบยอดกะแคชเชียร์ (`CashierShift Reconciliation`):**
   $$\text{ExpectedDrawerCash} = \text{OpeningFloatCash} + \sum \text{CashReceiptsInShift} + \sum \text{CashDepositsReceivedInShift} - \sum \text{CashDepositsRefundedInShift}$$
   $$\text{CashVariance} = \text{ActualCashCounted} - \text{ExpectedDrawerCash}$$
   หาก $\text{CashVariance} \ne 0.00$ พนักงานต้องระบุหมายเหตุชี้แจงก่อนกดปิดกะ (`Closed`) เพื่อให้หัวหน้างานตรวจสอบและกด `Reconciled`
