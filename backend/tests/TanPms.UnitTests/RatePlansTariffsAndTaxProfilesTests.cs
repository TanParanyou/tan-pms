using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Rates;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class RatePlansTariffsAndTaxProfilesTests
{
    [Fact]
    public void RatePlan_UpdateConfiguration_Should_Enforce_StayMode_And_AutoCap_Invariants()
    {
        var plan = new RatePlan
        {
            PropertyId = PmsSeedConstants.BkkPropertyId,
            UnitTypeId = PmsSeedConstants.StandardUnitTypeId,
            Code = "RP-TEST",
            Name = LocalizedText.Create("เรตทดสอบ", "Test Rate")
        };

        var emptyModesEx = Assert.Throws<DomainRuleException>(() =>
            plan.UpdateConfiguration(
                code: "RP-TEST",
                name: plan.Name,
                unitTypeId: plan.UnitTypeId,
                supportedStayModes: [],
                basePackageHours: 3,
                basePackagePrice: 500m,
                additionalHourPrice: 150m,
                gracePeriodMinutes: 15,
                autoCapToDailyRate: 1200m,
                turnaroundBufferMinutes: 30,
                weekdayRate: 1200m,
                weekendRate: 1400m,
                holidaySurchargeAmount: 200m,
                extraGuestPrice: 300m,
                monthlyRentRate: 7500m,
                minimumLeaseMonths: 6,
                securityDepositMonths: 2,
                isActive: true));
        Assert.Equal(DomainErrorCodes.ValidationFailed, emptyModesEx.ErrorCode);

        var capLowerThanBaseEx = Assert.Throws<DomainRuleException>(() =>
            plan.UpdateConfiguration(
                code: "RP-TEST",
                name: plan.Name,
                unitTypeId: plan.UnitTypeId,
                supportedStayModes: [StayMode.Hourly],
                basePackageHours: 3,
                basePackagePrice: 800m,
                additionalHourPrice: 150m,
                gracePeriodMinutes: 15,
                autoCapToDailyRate: 600m,
                turnaroundBufferMinutes: 30,
                weekdayRate: 1200m,
                weekendRate: 1400m,
                holidaySurchargeAmount: 200m,
                extraGuestPrice: 300m,
                monthlyRentRate: 7500m,
                minimumLeaseMonths: 6,
                securityDepositMonths: 2,
                isActive: true));
        Assert.Equal(DomainErrorCodes.ValidationFailed, capLowerThanBaseEx.ErrorCode);
    }

    [Fact]
    public void TaxProfile_UpdateProfile_Should_Enforce_Thai_Exempt_Vs_Vat_Rules()
    {
        var profile = new TaxProfile
        {
            PropertyId = PmsSeedConstants.BkkPropertyId,
            ChargeCategoryCode = "MONTHLY_RENT",
            Name = LocalizedText.Create("ค่าเช่า", "Rent")
        };

        var exemptNonZeroVatEx = Assert.Throws<DomainRuleException>(() =>
            profile.UpdateProfile(
                chargeCategoryCode: "MONTHLY_RENT",
                name: profile.Name,
                taxMode: TaxMode.Exempt,
                vatRatePercent: 7.00m,
                defaultWithholdingTaxPercent: 5.00m,
                isActive: true));
        Assert.Equal(DomainErrorCodes.ValidationFailed, exemptNonZeroVatEx.ErrorCode);

        var vatIncludedZeroVatEx = Assert.Throws<DomainRuleException>(() =>
            profile.UpdateProfile(
                chargeCategoryCode: "DAILY_STAY",
                name: profile.Name,
                taxMode: TaxMode.VatIncluded,
                vatRatePercent: 0.00m,
                defaultWithholdingTaxPercent: 0.00m,
                isActive: true));
        Assert.Equal(DomainErrorCodes.ValidationFailed, vatIncludedZeroVatEx.ErrorCode);

        profile.UpdateProfile(
            chargeCategoryCode: "monthly_rent",
            name: profile.Name,
            taxMode: TaxMode.Exempt,
            vatRatePercent: 0.00m,
            defaultWithholdingTaxPercent: 5.00m,
            isActive: true);

        Assert.Equal("MONTHLY_RENT", profile.ChargeCategoryCode);
        Assert.Equal(0.00m, profile.GetDecimalVatRate());
        Assert.Equal(0.05m, profile.GetDecimalWithholdingRate());
    }

    [Fact]
    public void PropertyUtilityTariff_Should_Validate_Digits_And_Calculate_MinimumUnits_And_FlatRatePerOccupant()
    {
        var tariffEntity = new PropertyUtilityTariff
        {
            PropertyId = PmsSeedConstants.BkkPropertyId,
            UtilityType = UtilityType.Water,
            Name = LocalizedText.Create("ค่าน้ำเหมาคน", "Occupant Water Tariff")
        };

        Assert.Throws<DomainRuleException>(() =>
            tariffEntity.UpdateTariff(
                name: tariffEntity.Name,
                billingMode: UtilityBillingMode.FlatRate,
                ratePerUnit: 0m,
                minimumChargeAmount: 0m,
                includedUnits: 0m,
                baseMinimumAmount: 0m,
                flatRateAmount: 150m,
                flatRatePerOccupant: true,
                meterMaxDigits: 0));

        tariffEntity.UpdateTariff(
            name: tariffEntity.Name,
            billingMode: UtilityBillingMode.FlatRate,
            ratePerUnit: 0m,
            minimumChargeAmount: 0m,
            includedUnits: 0m,
            baseMinimumAmount: 0m,
            flatRateAmount: 150m,
            flatRatePerOccupant: true,
            meterMaxDigits: 4);

        var calc = UtilityMeterCalculator.Calculate(
            previousReading: 100m,
            currentReading: 108m,
            tariff: tariffEntity.ToUtilityTariff(),
            isRolloverConfirmed: false,
            meterMaxDigits: tariffEntity.MeterMaxDigits,
            occupantCount: 3);

        Assert.Equal(8.00m, calc.UsageUnits);
        Assert.Equal(450.00m, calc.ChargeAmount);
    }

    [Fact]
    public void RateCatalog_Upserts_And_Simulation_Should_Enforce_Scope_Permissions_Audit_And_Rollover()
    {
        var store = new InMemoryOperationalService();

        var readOnlyContext = new TestCurrentUserContext
        {
            IsAdminScope = true,
            Permissions = new HashSet<string> { PermissionKeys.AdminPropertiesRead },
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId }
        };

        var catalogHandler = new GetAdminPropertyRateCatalogHandler(store, readOnlyContext);
        var catalogRes = catalogHandler.Handle(new GetAdminPropertyRateCatalogQuery(PmsSeedConstants.BkkPropertyId));
        Assert.True(catalogRes.IsSuccess);
        Assert.Equal(2, catalogRes.Value!.RatePlans.Count);
        Assert.Equal(2, catalogRes.Value.UtilityTariffs.Count);
        Assert.Equal(5, catalogRes.Value.TaxProfiles.Count); // includes seeded UTILITY_WATER / UTILITY_ELECTRIC

        var deniedUpsertHandler = new UpsertAdminRatePlanHandler(store, readOnlyContext, store);
        var deniedRes = deniedUpsertHandler.Handle(new UpsertAdminRatePlanCommand(
            PmsSeedConstants.BkkPropertyId,
            new UpsertRatePlanRequest(
                Id: null,
                Code: "RP-DENIED",
                Name: new LocalizedTextDto("ปฏิเสธ", "Denied"),
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                SupportedStayModes: ["Hourly"],
                HourlyPackage: new HourlyPackageConfigDto(3, 450m, 100m, 15, 1000m, 30),
                DailyRate: new DailyRateConfigDto(1000m, 1200m, 200m, 250m),
                MonthlyRate: new MonthlyRateConfigDto(7000m, 6, 2),
                IsActive: true)));
        Assert.True(deniedRes.IsFailure);
        Assert.Equal(DomainErrorCodes.PermissionDenied, deniedRes.Error.Code);

        var managerContext = new TestCurrentUserContext
        {
            IsAdminScope = true,
            Permissions = new HashSet<string> { PermissionKeys.AdminRatesManage },
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId }
        };

        var upsertPlanHandler = new UpsertAdminRatePlanHandler(store, managerContext, store);
        var createdPlanRes = upsertPlanHandler.Handle(new UpsertAdminRatePlanCommand(
            PmsSeedConstants.BkkPropertyId,
            new UpsertRatePlanRequest(
                Id: null,
                Code: "RP-PROMO-2026",
                Name: new LocalizedTextDto("โปรโมชันปลายปี", "Year-End Promo"),
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                SupportedStayModes: ["Hourly", "Daily"],
                HourlyPackage: new HourlyPackageConfigDto(3, 390m, 120m, 15, 990m, 30),
                DailyRate: new DailyRateConfigDto(990m, 1190m, 200m, 250m),
                MonthlyRate: new MonthlyRateConfigDto(7200m, 6, 2),
                IsActive: true)));

        Assert.True(createdPlanRes.IsSuccess);
        Assert.Contains(store.AuditEvents, e => e.Reason.Contains("RP-PROMO-2026"));

        var simHandler = new SimulateAdminRateAndTaxHandler(store, managerContext);

        // Unconfirmed meter rollover should fail with meter.rollover_unconfirmed
        var unconfirmedSim = simHandler.Handle(new SimulateAdminRateAndTaxCommand(
            PmsSeedConstants.BkkPropertyId,
            new RateSimulationRequest(
                RatePlanId: createdPlanRes.Value!.Id,
                DurationMinutes: 600,
                WaterPreviousReading: 9995m,
                WaterCurrentReading: 4m,
                WaterRolloverConfirmed: false,
                ElectricPreviousReading: 1200m,
                ElectricCurrentReading: 1250m,
                ElectricRolloverConfirmed: false,
                OccupantCount: 2,
                TaxProfileId: PmsSeedConstants.FurnitureVatExcludedTaxProfileId,
                SampleLineAmount: 1000m,
                ApplyWithholdingTax: true)));

        Assert.True(unconfirmedSim.IsFailure);
        Assert.Equal(DomainErrorCodes.MeterRolloverUnconfirmed, unconfirmedSim.Error.Code);

        // Confirmed meter rollover + capped hourly + VatExcluded 7% + WHT 5%
        var confirmedSim = simHandler.Handle(new SimulateAdminRateAndTaxCommand(
            PmsSeedConstants.BkkPropertyId,
            new RateSimulationRequest(
                RatePlanId: createdPlanRes.Value.Id,
                DurationMinutes: 600,
                WaterPreviousReading: 9995m,
                WaterCurrentReading: 4m,
                WaterRolloverConfirmed: true,
                ElectricPreviousReading: 1200m,
                ElectricCurrentReading: 1250m,
                ElectricRolloverConfirmed: false,
                OccupantCount: 2,
                TaxProfileId: PmsSeedConstants.FurnitureVatExcludedTaxProfileId,
                SampleLineAmount: 1000m,
                ApplyWithholdingTax: true)));

        Assert.True(confirmedSim.IsSuccess);
        Assert.True(confirmedSim.Value!.HourlyQuote.IsCappedToDailyRate);
        Assert.Equal(990.00m, confirmedSim.Value.HourlyQuote.FinalHourlyRoomCharge);
        Assert.Equal(9.00m, confirmedSim.Value.WaterQuote.UsageUnits);
        Assert.True(confirmedSim.Value.WaterQuote.UsedRollover);
        Assert.Equal(172.00m, confirmedSim.Value.WaterQuote.ChargeAmount); // 100 base (5 units) + 4 * 18 = 172
        Assert.Equal(50.00m, confirmedSim.Value.ElectricQuote.UsageUnits);
        Assert.Equal(400.00m, confirmedSim.Value.ElectricQuote.ChargeAmount); // 50 * 8 = 400
        Assert.Equal(1000.00m, confirmedSim.Value.TaxQuote.SubTotal);
        Assert.Equal(70.00m, confirmedSim.Value.TaxQuote.VatAmount);
        Assert.Equal(1070.00m, confirmedSim.Value.TaxQuote.InvoiceTotal);
        Assert.Equal(50.00m, confirmedSim.Value.TaxQuote.WithholdingTaxAmount);
        Assert.Equal(1020.00m, confirmedSim.Value.TaxQuote.NetPayable);
    }

    private sealed class TestCurrentUserContext : ICurrentUserContext
    {
        public string UserId { get; set; } = "test-user";
        public bool IsAdminScope { get; set; }
        public bool IsClientScope { get; set; }
        public IReadOnlySet<Guid> AllowedPropertyIds { get; set; } = new HashSet<Guid>();
        public IReadOnlySet<string> Permissions { get; set; } = new HashSet<string>();
        public Guid? CustomerId { get; set; }
        public bool HasOpenCashierShift { get; set; }
    }
}
