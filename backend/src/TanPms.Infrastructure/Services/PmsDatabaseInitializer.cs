using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TanPms.Application.Common.Abstractions;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Identity;
using TanPms.Domain.Leases;
using TanPms.Domain.Notifications;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;
using TanPms.Infrastructure.Persistence;

namespace TanPms.Infrastructure.Services;

public static class PmsDatabaseInitializer
{
    public static async Task InitializeIfPostgresAsync(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var provider = configuration["Persistence:Provider"] ?? "Postgres";
        if (string.Equals(provider, "InMemory", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        try
        {
            using var scope = serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
            var docNumberService = scope.ServiceProvider.GetRequiredService<IDocumentNumberService>();

            await dbContext.Database.MigrateAsync(cancellationToken);
            await SeedIfEmptyAsync(dbContext, docNumberService, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "PostgreSQL auto-migration/seed skipped because the database was unreachable at startup.");
        }
    }

    public static async Task SeedIfEmptyAsync(
        TanPmsDbContext dbContext,
        IDocumentNumberService documentNumberService,
        CancellationToken cancellationToken = default)
    {
        if (await dbContext.Properties.IgnoreQueryFilters().AnyAsync(cancellationToken))
        {
            return;
        }

        var bkk = new Property
        {
            Id = PmsSeedConstants.BkkPropertyId,
            Code = "BKK01",
            Name = LocalizedText.Create("แทน เรสซิเดนซ์ รัชดา", "TAN Residence Ratchada"),
            TaxBranchCode = "00000",
            Address = LocalizedText.Create("123 ถนนรัชดาภิเษก ดินแดง กรุงเทพฯ 10400", "123 Ratchadaphisek Rd, Din Daeng, Bangkok 10400")
        };
        bkk.ValidateTaxBranchCode();

        var cnx = new Property
        {
            Id = PmsSeedConstants.CnxPropertyId,
            Code = "CNX01",
            Name = LocalizedText.Create("แทน สวีท นิมมาน", "TAN Suites Nimman"),
            TaxBranchCode = "00001",
            Address = LocalizedText.Create("45 ถนนนิมมานเหมินท์ สุเทพ เมือง เชียงใหม่ 50200", "45 Nimmanhaemin Rd, Suthep, Mueang, Chiang Mai 50200")
        };
        cnx.ValidateTaxBranchCode();

        dbContext.Properties.AddRange(bkk, cnx);

        var orgAdmin = new AdminUser
        {
            Username = "naphat.admin",
            FullName = "Naphat Wattanakul",
            Email = "naphat@tan-pms.internal",
            RoleCode = RoleCodes.OrganizationAdmin,
            RoleName = LocalizedText.Create("ผู้บริหารระดับองค์กร", "Organization Administrator")
        };
        orgAdmin.AssignRoleAndScope(
            RoleCodes.OrganizationAdmin,
            LocalizedText.Create("ผู้บริหารระดับองค์กร", "Organization Administrator"),
            [bkk.Id, cnx.Id],
            PermissionKeys.All,
            isActive: true);

        var bkkCashier = new AdminUser
        {
            Username = "pimchanok.bkk",
            FullName = "Pimchanok Srisawat",
            Email = "pimchanok@tan-pms.internal",
            RoleCode = RoleCodes.FrontDeskCashier,
            RoleName = LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier")
        };
        bkkCashier.AssignRoleAndScope(
            RoleCodes.FrontDeskCashier,
            LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier"),
            [bkk.Id],
            PmsRoleCatalog.Roles[2].DefaultPermissions,
            isActive: true);

        var cnxManager = new AdminUser
        {
            Username = "kittisak.cnx",
            FullName = "Kittisak Lertlum",
            Email = "kittisak@tan-pms.internal",
            RoleCode = RoleCodes.PropertyManager,
            RoleName = LocalizedText.Create("ผู้จัดการสาขา", "Property Manager")
        };
        cnxManager.AssignRoleAndScope(
            RoleCodes.PropertyManager,
            LocalizedText.Create("ผู้จัดการสาขา", "Property Manager"),
            [cnx.Id],
            PmsRoleCatalog.Roles[1].DefaultPermissions,
            isActive: true);

        dbContext.AdminUsers.AddRange(orgAdmin, bkkCashier, cnxManager);

        var buildingA = new Building
        {
            Id = PmsSeedConstants.BkkBuildingAId,
            PropertyId = bkk.Id,
            Code = "BLD-A",
            Name = LocalizedText.Create("อาคาร A", "Building A")
        };

        var floor1 = new Floor
        {
            Id = PmsSeedConstants.BkkFloor1Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorNumber = 1,
            Name = LocalizedText.Create("ชั้น 1", "Floor 1")
        };

        var floor2 = new Floor
        {
            Id = PmsSeedConstants.BkkFloor2Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorNumber = 2,
            Name = LocalizedText.Create("ชั้น 2", "Floor 2")
        };

        dbContext.Buildings.Add(buildingA);
        dbContext.Floors.AddRange(floor1, floor2);

        var standardType = new UnitType
        {
            Id = PmsSeedConstants.StandardUnitTypeId,
            PropertyId = bkk.Id,
            Code = "STD",
            Name = LocalizedText.Create("มาตรฐาน 24 ตร.ม.", "Standard 24 sqm"),
            Description = LocalizedText.Create("ห้องมาตรฐาน 1 ห้องนอน", "Standard 1-bedroom room"),
            AreaSqm = 24m,
            TotalQuotaUnits = 2,
            SupportedStayModes = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            HourlyBasePackagePrice = 500m,
            HourlyBasePackageHours = 3,
            HourlyAdditionalHourPrice = 150m,
            DailyRate = 1200m,
            MonthlyRentRate = 7500m
        };

        var deluxeType = new UnitType
        {
            Id = PmsSeedConstants.DeluxeUnitTypeId,
            PropertyId = bkk.Id,
            Code = "DLX",
            Name = LocalizedText.Create("ดีลักซ์ 32 ตร.ม.", "Deluxe 32 sqm"),
            Description = LocalizedText.Create("ห้องดีลักซ์ พร้อมระเบียง", "Deluxe room with balcony"),
            AreaSqm = 32m,
            TotalQuotaUnits = 1,
            SupportedStayModes = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            HourlyBasePackagePrice = 700m,
            HourlyBasePackageHours = 3,
            HourlyAdditionalHourPrice = 200m,
            DailyRate = 1600m,
            MonthlyRentRate = 9500m
        };

        dbContext.UnitTypes.AddRange(standardType, deluxeType);

        var unitA101 = new Unit
        {
            Id = PmsSeedConstants.CleanUnitA101Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorId = floor1.Id,
            UnitTypeId = standardType.Id,
            UnitNumber = "A-101"
        };
        unitA101.UpdateConfiguration([StayMode.Hourly, StayMode.Daily, StayMode.Monthly], ConditionStatus.Clean);
        unitA101.ReplaceAssets([
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA101.Id,
                AssetCode = "AST-00001",
                Name = LocalizedText.Create("แอร์ Daikin Inverter", "Daikin Inverter AC"),
                ReplacementCostAmount = 18000m
            },
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA101.Id,
                AssetCode = "AST-00002",
                Name = LocalizedText.Create("สมาร์ททีวี Samsung 43 นิ้ว", "Samsung 43-inch Smart TV"),
                ReplacementCostAmount = 12000m
            },
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA101.Id,
                AssetCode = "AST-00003",
                Name = LocalizedText.Create("ชุดคีย์การ์ดและกุญแจ", "Keycard & Room Key Set"),
                ReplacementCostAmount = 500m
            }
        ]);

        var unitA102 = new Unit
        {
            Id = PmsSeedConstants.DirtyUnitA102Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorId = floor1.Id,
            UnitTypeId = standardType.Id,
            UnitNumber = "A-102"
        };
        unitA102.UpdateConfiguration([StayMode.Hourly, StayMode.Daily, StayMode.Monthly], ConditionStatus.Dirty);
        unitA102.ReplaceAssets([
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA102.Id,
                AssetCode = "AST-00004",
                Name = LocalizedText.Create("แอร์ Daikin Inverter", "Daikin Inverter AC"),
                ReplacementCostAmount = 18000m
            },
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA102.Id,
                AssetCode = "AST-00005",
                Name = LocalizedText.Create("ชุดคีย์การ์ดและกุญแจ", "Keycard & Room Key Set"),
                ReplacementCostAmount = 500m
            }
        ]);

        var unitA201 = new Unit
        {
            Id = PmsSeedConstants.OccupiedMonthlyUnitA201Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorId = floor2.Id,
            UnitTypeId = deluxeType.Id,
            UnitNumber = "A-201"
        };
        unitA201.UpdateConfiguration([StayMode.Daily, StayMode.Monthly], ConditionStatus.Clean);
        unitA201.MarkOccupied();
        unitA201.ReplaceAssets([
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA201.Id,
                AssetCode = "AST-00006",
                Name = LocalizedText.Create("สมาร์ททีวี Sony 55 นิ้ว", "Sony 55-inch Smart TV"),
                ReplacementCostAmount = 22000m
            },
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA201.Id,
                AssetCode = "AST-00007",
                Name = LocalizedText.Create("ตู้เย็น 2 ประตู 7.4 คิว", "2-Door Refrigerator 7.4 cu.ft"),
                ReplacementCostAmount = 8500m
            },
            new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = bkk.Id,
                UnitId = unitA201.Id,
                AssetCode = "AST-00008",
                Name = LocalizedText.Create("ชุดคีย์การ์ดและกุญแจ", "Keycard & Room Key Set"),
                ReplacementCostAmount = 500m
            }
        ]);

        dbContext.Units.AddRange(unitA101, unitA102, unitA201);
        dbContext.UnitAssets.AddRange(unitA101.Assets);
        dbContext.UnitAssets.AddRange(unitA102.Assets);
        dbContext.UnitAssets.AddRange(unitA201.Assets);

        var customer1 = new Customer
        {
            Id = PmsSeedConstants.PrimaryCustomerId,
            FullName = "Somchai Rakdee",
            NationalIdOrPassport = "1100501234123"
        };

        var customer2 = new Customer
        {
            Id = PmsSeedConstants.SecondaryCustomerId,
            FullName = "Sudaawattana Jaidee",
            NationalIdOrPassport = "3100909876541"
        };

        var foreignCustomer = new Customer
        {
            Id = Guid.Parse("44444444-4444-4444-4444-444444444403"),
            FullName = "Johnathan Miller",
            NationalIdOrPassport = "US99887766",
            IsPassport = true,
            PhoneNumber = "+1-415-555-0199"
        };

        dbContext.Customers.AddRange(customer1, customer2, foreignCustomer);

        var lease1 = new Lease
        {
            PropertyId = bkk.Id,
            DocumentNumber = await documentNumberService.NextDocumentNumberAsync(bkk.Id, bkk.Code, DocumentTypeCode.LSE, new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), cancellationToken),
            UnitId = unitA201.Id,
            CustomerId = customer1.Id,
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 12, 31),
            MonthlyRentAmount = 8500.00m,
            SecurityDepositAmount = 17000.00m
        };
        lease1.Activate();
        dbContext.Leases.Add(lease1);

        var invoice1 = new Invoice
        {
            PropertyId = bkk.Id,
            DocumentNumber = await documentNumberService.NextDocumentNumberAsync(bkk.Id, bkk.Code, DocumentTypeCode.INV, new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), cancellationToken),
            CustomerId = customer1.Id,
            LeaseId = lease1.Id,
            BillingPeriodYearMonth = "2026-11"
        };
        invoice1.AddLine("ค่าเช่าห้องรายเดือน (พ.ย. 2569)", 8500.00m, TaxMode.Exempt, "Monthly Room Rent (Nov 2026)");
        invoice1.AddLine("ค่าเช่าเฟอร์นิเจอร์", 1000.00m, TaxMode.VatExcluded, "Furniture Rental");
        invoice1.Issue();

        var invoice2 = new Invoice
        {
            PropertyId = bkk.Id,
            DocumentNumber = await documentNumberService.NextDocumentNumberAsync(bkk.Id, bkk.Code, DocumentTypeCode.INV, new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), cancellationToken),
            CustomerId = customer2.Id
        };
        invoice2.AddLine("ยอดค้างค่าห้องรายวัน", 1200.00m, TaxMode.VatIncluded, "Daily Stay Balance");
        invoice2.Issue();

        dbContext.Invoices.AddRange(invoice1, invoice2);
        dbContext.Set<InvoiceLine>().AddRange(invoice1.Lines);
        dbContext.Set<InvoiceLine>().AddRange(invoice2.Lines);

        dbContext.Parcels.Add(new Parcel
        {
            PropertyId = bkk.Id,
            DocumentNumber = await documentNumberService.NextDocumentNumberAsync(bkk.Id, bkk.Code, DocumentTypeCode.PCL, new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), cancellationToken),
            UnitId = unitA201.Id,
            CustomerId = customer1.Id,
            CarrierName = "Kerry Express",
            TrackingNumber = "KEX123456789TH"
        });

        dbContext.NotificationMessages.Add(new NotificationMessage
        {
            PropertyId = bkk.Id,
            CustomerId = customer1.Id,
            Channel = NotificationChannel.InApp,
            TemplateKey = "parcel.arrived",
            Title = LocalizedText.Create("มีพัสดุมาถึงห้อง A-201", "New parcel arrived for Unit A-201"),
            Body = LocalizedText.Create("พัสดุ Kerry Express เลขที่ BKK01-PCL-2611-0001 รอรับที่เคาน์เตอร์", "Parcel BKK01-PCL-2611-0001 from Kerry Express is ready for pickup.")
        });

        var standardRatePlan = new RatePlan
        {
            Id = PmsSeedConstants.StandardRatePlanId,
            PropertyId = bkk.Id,
            UnitTypeId = standardType.Id,
            Code = "RP-STD-2026",
            Name = LocalizedText.Create("เรตมาตรฐาน 3 โหมด (Standard)", "Standard 3-Mode Rate Plan")
        };
        standardRatePlan.UpdateConfiguration(
            code: "RP-STD-2026",
            name: standardRatePlan.Name,
            unitTypeId: standardType.Id,
            supportedStayModes: [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            basePackageHours: 3,
            basePackagePrice: 500.00m,
            additionalHourPrice: 150.00m,
            gracePeriodMinutes: 15,
            autoCapToDailyRate: 1200.00m,
            turnaroundBufferMinutes: 30,
            weekdayRate: 1200.00m,
            weekendRate: 1400.00m,
            holidaySurchargeAmount: 250.00m,
            extraGuestPrice: 300.00m,
            monthlyRentRate: 7500.00m,
            minimumLeaseMonths: 6,
            securityDepositMonths: 2,
            isActive: true);

        var deluxeRatePlan = new RatePlan
        {
            Id = PmsSeedConstants.DeluxeRatePlanId,
            PropertyId = bkk.Id,
            UnitTypeId = deluxeType.Id,
            Code = "RP-DLX-2026",
            Name = LocalizedText.Create("เรตดีลักซ์ พรีเมียม (Deluxe)", "Deluxe Premium Rate Plan")
        };
        deluxeRatePlan.UpdateConfiguration(
            code: "RP-DLX-2026",
            name: deluxeRatePlan.Name,
            unitTypeId: deluxeType.Id,
            supportedStayModes: [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            basePackageHours: 3,
            basePackagePrice: 700.00m,
            additionalHourPrice: 200.00m,
            gracePeriodMinutes: 15,
            autoCapToDailyRate: 1600.00m,
            turnaroundBufferMinutes: 30,
            weekdayRate: 1600.00m,
            weekendRate: 1850.00m,
            holidaySurchargeAmount: 350.00m,
            extraGuestPrice: 400.00m,
            monthlyRentRate: 9500.00m,
            minimumLeaseMonths: 6,
            securityDepositMonths: 2,
            isActive: true);

        dbContext.RatePlans.AddRange(standardRatePlan, deluxeRatePlan);

        var bkkWaterTariff = new PropertyUtilityTariff
        {
            Id = PmsSeedConstants.BkkWaterTariffId,
            PropertyId = bkk.Id,
            UtilityType = UtilityType.Water,
            Name = LocalizedText.Create("อัตราค่าน้ำประปา (เหมาขั้นต่ำ 5 หน่วย)", "Water Tariff (5 Units Minimum)")
        };
        bkkWaterTariff.UpdateTariff(
            name: bkkWaterTariff.Name,
            billingMode: UtilityBillingMode.MinimumUnits,
            ratePerUnit: 18.00m,
            minimumChargeAmount: 100.00m,
            includedUnits: 5.00m,
            baseMinimumAmount: 100.00m,
            flatRateAmount: 0.00m,
            flatRatePerOccupant: false,
            meterMaxDigits: 4);

        var bkkElectricTariff = new PropertyUtilityTariff
        {
            Id = PmsSeedConstants.BkkElectricTariffId,
            PropertyId = bkk.Id,
            UtilityType = UtilityType.Electric,
            Name = LocalizedText.Create("อัตราค่าไฟฟ้า (คิดตามหน่วยจริง)", "Electricity Tariff (Per Unit)")
        };
        bkkElectricTariff.UpdateTariff(
            name: bkkElectricTariff.Name,
            billingMode: UtilityBillingMode.PerUnit,
            ratePerUnit: 8.00m,
            minimumChargeAmount: 100.00m,
            includedUnits: 0.00m,
            baseMinimumAmount: 0.00m,
            flatRateAmount: 0.00m,
            flatRatePerOccupant: false,
            meterMaxDigits: 4);

        dbContext.PropertyUtilityTariffs.AddRange(bkkWaterTariff, bkkElectricTariff);

        var monthlyRentTax = new TaxProfile
        {
            Id = PmsSeedConstants.MonthlyRentExemptTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "MONTHLY_ROOM_RENT",
            Name = LocalizedText.Create("ค่าเช่าห้องพักตามสัญญารายเดือน (ยกเว้น VAT)", "Monthly Lease Room Rent (VAT Exempt)")
        };
        monthlyRentTax.UpdateProfile(
            chargeCategoryCode: "MONTHLY_ROOM_RENT",
            name: monthlyRentTax.Name,
            taxMode: TaxMode.Exempt,
            vatRatePercent: 0.00m,
            defaultWithholdingTaxPercent: 5.00m,
            isActive: true);

        var shortStayTax = new TaxProfile
        {
            Id = PmsSeedConstants.ShortStayVatIncludedTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "SHORT_STAY_ROOM",
            Name = LocalizedText.Create("ค่าห้องพักรายชั่วโมง/รายวัน (รวม VAT 7%)", "Hourly & Daily Stay Charge (VAT 7% Included)")
        };
        shortStayTax.UpdateProfile(
            chargeCategoryCode: "SHORT_STAY_ROOM",
            name: shortStayTax.Name,
            taxMode: TaxMode.VatIncluded,
            vatRatePercent: 7.00m,
            defaultWithholdingTaxPercent: 0.00m,
            isActive: true);

        var furnitureTax = new TaxProfile
        {
            Id = PmsSeedConstants.FurnitureVatExcludedTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "FURNITURE_RENTAL",
            Name = LocalizedText.Create("ค่าเช่าเฟอร์นิเจอร์และบริการ (แยก VAT 7%)", "Furniture & Service Fee (VAT 7% Excluded)")
        };
        furnitureTax.UpdateProfile(
            chargeCategoryCode: "FURNITURE_RENTAL",
            name: furnitureTax.Name,
            taxMode: TaxMode.VatExcluded,
            vatRatePercent: 7.00m,
            defaultWithholdingTaxPercent: 5.00m,
            isActive: true);

        // Utilities resold to tenants are not pure room rent (docs/01-business/pricing-meter-and-tax-rules.md section 3),
        // so they carry VAT 7%; VatIncluded keeps the tariff charge as the line total.
        var waterTax = new TaxProfile
        {
            Id = PmsSeedConstants.WaterUtilityTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "UTILITY_WATER",
            Name = LocalizedText.Create("ค่าน้ำประปาตามมิเตอร์ (รวม VAT 7%)", "Metered Water (VAT 7% Included)")
        };
        waterTax.UpdateProfile(
            chargeCategoryCode: "UTILITY_WATER",
            name: waterTax.Name,
            taxMode: TaxMode.VatIncluded,
            vatRatePercent: 7.00m,
            defaultWithholdingTaxPercent: 0.00m,
            isActive: true);

        var electricTax = new TaxProfile
        {
            Id = PmsSeedConstants.ElectricUtilityTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "UTILITY_ELECTRIC",
            Name = LocalizedText.Create("ค่าไฟฟ้าตามมิเตอร์ (รวม VAT 7%)", "Metered Electricity (VAT 7% Included)")
        };
        electricTax.UpdateProfile(
            chargeCategoryCode: "UTILITY_ELECTRIC",
            name: electricTax.Name,
            taxMode: TaxMode.VatIncluded,
            vatRatePercent: 7.00m,
            defaultWithholdingTaxPercent: 0.00m,
            isActive: true);

        dbContext.TaxProfiles.AddRange(monthlyRentTax, shortStayTax, furnitureTax, waterTax, electricTax);

        var seedNowUtc = DateTimeOffset.UtcNow;
        var sampleHoldDocNo = await documentNumberService.NextDocumentNumberAsync(
            bkk.Id,
            bkk.Code,
            DocumentTypeCode.RES,
            seedNowUtc,
            cancellationToken);

        var sampleHold = Reservation.CreateOnlineHold(
            propertyId: bkk.Id,
            documentNumber: sampleHoldDocNo,
            customerId: customer1.Id,
            unitTypeId: standardType.Id,
            stayMode: StayMode.Daily,
            slotStartAt: seedNowUtc.AddDays(14),
            slotEndAt: seedNowUtc.AddDays(16),
            depositAmount: 1200.00m,
            nowUtc: seedNowUtc,
            holdTtlMinutes: 15,
            id: PmsSeedConstants.SampleHoldReservationId);

        var sampleConfirmedDocNo = await documentNumberService.NextDocumentNumberAsync(
            bkk.Id,
            bkk.Code,
            DocumentTypeCode.RES,
            seedNowUtc,
            cancellationToken);

        var sampleConfirmed = Reservation.CreateByAdmin(
            propertyId: bkk.Id,
            documentNumber: sampleConfirmedDocNo,
            customerId: customer2.Id,
            unitTypeId: standardType.Id,
            stayMode: StayMode.Hourly,
            slotStartAt: seedNowUtc.AddDays(20),
            slotEndAt: seedNowUtc.AddDays(20).AddHours(3),
            depositAmount: 250.00m,
            nowUtc: seedNowUtc,
            confirmImmediately: true,
            unitId: unitA101.Id,
            id: PmsSeedConstants.SampleConfirmedReservationId);

        dbContext.Reservations.AddRange(sampleHold, sampleConfirmed);

        var octStayCheckIn = new DateTimeOffset(2026, 10, 20, 7, 0, 0, TimeSpan.Zero);
        var octStay = new Stay
        {
            PropertyId = bkk.Id,
            DocumentNumber = await documentNumberService.NextDocumentNumberAsync(bkk.Id, bkk.Code, DocumentTypeCode.STY, new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero), cancellationToken),
            UnitId = unitA102.Id,
            CustomerId = foreignCustomer.Id,
            StayMode = StayMode.Daily,
            CheckInAt = octStayCheckIn,
            ExpectedCheckOutAt = octStayCheckIn.AddDays(2),
            KeyDepositAmount = 0m
        };
        var octFolio = new Folio
        {
            PropertyId = bkk.Id,
            StayId = octStay.Id
        };
        octFolio.AddCharge("ค่าห้องพักรายวัน (A-102)", 2400.00m, TaxMode.VatIncluded, "Daily Room Charge (A-102)");
        octFolio.RecordPayment(2400.00m);
        octStay.CompleteCheckOut(octFolio, null, octStayCheckIn.AddDays(2));

        dbContext.Stays.Add(octStay);
        dbContext.Folios.Add(octFolio);
        dbContext.Set<FolioCharge>().AddRange(octFolio.Charges);

        dbContext.Occupants.AddRange(
            new Occupant
            {
                PropertyId = bkk.Id,
                CustomerId = customer1.Id,
                LeaseId = lease1.Id,
                FullName = customer1.FullName,
                NationalityCode = "THA",
                IdentityNumber = customer1.NationalIdOrPassport,
                IsPrimaryOccupant = true,
                VehicleLicensePlate = "1กข-8899"
            },
            new Occupant
            {
                PropertyId = bkk.Id,
                CustomerId = foreignCustomer.Id,
                StayId = octStay.Id,
                FullName = foreignCustomer.FullName,
                NationalityCode = "USA",
                IdentityNumber = foreignCustomer.NationalIdOrPassport,
                IsPrimaryOccupant = true
            });

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
