# Module Boundaries & Vertical Slice Ownership — `tan-pms`

เอกสารนี้กำหนดขอบเขตความรับผิดชอบของแต่ละโมดูล (`PM-01` ถึง `PM-10`) และกฎการสื่อสารข้ามโมดูลภายในสถาปัตยกรรม Modular Monolith ของ **`tan-pms`**

> อ้างอิงแผนการพัฒนาจาก [implementation-roadmap.md](../00-overview/implementation-roadmap.md) และคำศัพท์จาก [CONTEXT.md](../../CONTEXT.md)

---

## 1. ตารางความเป็นเจ้าของข้อมูลรายโมดูล (Module Ownership Matrix)

ห้ามโมดูลหนึ่งเขียนข้อมูล (`INSERT`/`UPDATE`/`DELETE`) ลงในตารางที่โมดูลอื่นเป็นเจ้าของโดยตรง ต้องเรียกผ่าน Application Service / Command Handler หรือ Domain Event ของโมดูลเจ้าของเท่านั้น:

| รหัสโมดูล | ชื่อโมดูล | เอนทิตีที่เป็นเจ้าของ (Owned Aggregates / Entities) | บริการที่เปิดให้โมดูลอื่นเรียกใช้ (Exposed Contracts) |
|---|---|---|---|
| `PM-01` | Identity, RBAC & Core | `User`, `Role`, `Permission`, `UserPropertyScope`, `DocumentSequence`, `StoredFile`, `AuditEvent`, `NotificationLog` | `ICurrentUserContext`, `IDocumentNumberService`, `IFileStorage`, `INotificationSender`, `IAuditLogger` |
| `PM-02` | Property & Unit Master | `Property`, `Building`, `Floor`, `UnitType`, `Unit`, `UnitAsset` | `IUnitReadService`, `IUnitStatusCommandService` |
| `PM-03` | Rates, Tariffs & Tax | `HourlyRateRule`, `DailyRatePlan`, `MonthlyRatePlan`, `UtilityTariff`, `TaxProfile` | `IPricingCalculationService`, `ITaxCalculationService` |
| `PM-04` | Availability & Reservation | `Reservation`, `UnitAvailabilitySlot` | `IAvailabilityEngine` (ตรวจโควตา `UnitType`, ล็อก `Unit` ใน `tstzrange` และจัดการ `Hold TTL`) |
| `PM-05` | Front Desk (`Stay` & `Folio`) | `Customer`, `Occupant`, `Stay`, `Folio`, `FolioCharge` | `IStayService`, `IFolioSettlementService`, `IRegulatoryReportExporter` (ร.ร.4 / ตม.30) |
| `PM-06` | Monthly Lease Lifecycle | `Lease`, `LeaseInspection`, `TenantVehicle` | `ILeaseService` (ผูกกับ `IAvailabilityEngine` และ `IDepositLedgerService`) |
| `PM-07` | Utility Meter & Batch Billing | `MeterReading`, `BillingRun` | `IMeterReadingService`, `IBatchBillingService` |
| `PM-08` | Cashier, Billing & Deposit | `Invoice`, `InvoiceLine`, `Receipt`, `PaymentSlipSubmission`, `CashierShift`, `DepositLedger`, `DepositTransaction` | `IInvoiceService`, `ICashierShiftGuard`, `IDepositLedgerService` |
| `PM-09` | Housekeeping, WorkOrder & Parcel | `HousekeepingTask`, `WorkOrder`, `Parcel` | `IHousekeepingTrigger` (รับ Event เมื่อ `Stay`/`Lease` สิ้นสุด), `IWorkOrderBillingBridge` |
| `PM-10` | Client Experience & Analytics | Read Models / Dapper Views สำหรับหน้า `/client/...` และ `/admin/analytics` | Dapper Query Handlers อ่านข้อมูลข้ามตารางแบบ Read-Only |

---

## 2. กฎการสื่อสารระหว่างโมดูล (Cross-Module Interaction Rules)

1. **เมื่อ `Stay` เช็กเอาต์ (`PM-05`) หรือ `Lease` ย้ายออก (`PM-06`):**
   - ต้องตรวจสอบกับ `PM-08` ว่ายอดค้างใน `Folio`/`Invoice` เป็นศูนย์และจัดการเงินมัดจำใน `DepositLedger` แล้ว
   - ส่งคำสั่งผ่าน `PM-02` เพื่อเปลี่ยน `Unit.ConditionStatus = Dirty` และสร้าง `HousekeepingTask` ใน `PM-09` ภายใน Transaction เดียวกัน
2. **เมื่อใบงานซ่อม `WorkOrder` (`PM-09`) มีค่าใช้จ่ายที่ผู้เช่าต้องรับผิดชอบ:**
   - ห้าม `PM-09` สร้างแถวใน `InvoiceLine` หรือ `FolioCharge` โดยตรง ให้เรียก `IInvoiceService.AddChargeFromWorkOrderAsync` หรือ `IFolioSettlementService.AddChargeAsync`
3. **เมื่อมีการรับชำระเงินสดใน `PM-05`, `PM-06`, หรือ `PM-08`:**
   - ต้องผ่าน `ICashierShiftGuard.EnsureOpenShiftAsync(currentUserId, propertyId)` เสมอ หากพนักงานยังไม่ได้เปิดกะแคชเชียร์ ระบบต้องปฏิเสธด้วยรหัส `shift.not_open`
