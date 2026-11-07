using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Meters;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Leases;
using TanPms.Domain.Meters;
using TanPms.Domain.Rates;

namespace TanPms.Infrastructure.Services;

// Per-unit facts a store gathers before evaluating meter rows or drafting invoices.
internal sealed record LeaseMeterContext(
    Lease Lease,
    UnitRefDto UnitRef,
    Customer Customer,
    int OccupantCount,
    IReadOnlyList<MeterReading> UnitReadings,
    bool IsLocked);

// Shared by the EF Core and in-memory stores so meter sheets, bulk saves and draft invoices compute identically.
internal static class MeterBillingComposer
{
    internal static MeterReadingSheetRowDto BuildSheetRow(
        LeaseMeterContext context,
        string period,
        PropertyUtilityTariff? waterTariff,
        PropertyUtilityTariff? electricTariff) =>
        new(
            Unit: context.UnitRef,
            LeaseId: context.Lease.Id,
            LeaseDocumentNumber: context.Lease.DocumentNumber,
            Customer: new CustomerRefDto(context.Customer.Id, context.Customer.FullName, context.Customer.GetMaskedIdentity()),
            OccupantCount: context.OccupantCount,
            IsLocked: context.IsLocked,
            Water: BuildUtilityReading(context, UtilityType.Water, period, waterTariff),
            Electric: BuildUtilityReading(context, UtilityType.Electric, period, electricTariff));

    private static UtilityReadingDto BuildUtilityReading(
        LeaseMeterContext context,
        UtilityType utilityType,
        string period,
        PropertyUtilityTariff? tariff)
    {
        var (previousReading, previousUsage) = MeterReadingRules.ResolvePrevious(context.Lease, utilityType, period, context.UnitReadings);
        var current = context.UnitReadings.FirstOrDefault(r => r.UtilityType == utilityType && r.BillingPeriodYearMonth == period);
        return new UtilityReadingDto(
            MeterMaxDigits: tariff?.MeterMaxDigits,
            PreviousReading: current?.PreviousReading ?? previousReading,
            PreviousUsageUnits: previousUsage,
            CurrentReading: current?.CurrentReading,
            UsageUnits: current?.UsageUnits,
            ChargeAmount: current?.ChargeAmount,
            IsRolloverConfirmed: current?.IsRolloverConfirmed ?? false,
            PhotoFileKey: current?.PhotoFileKey);
    }

    internal static List<MeterReadingRowResultDto> EvaluateSave(
        SaveMeterReadingsRequest request,
        string period,
        IReadOnlyDictionary<Guid, LeaseMeterContext> contextsByUnitId,
        PropertyUtilityTariff? waterTariff,
        PropertyUtilityTariff? electricTariff,
        bool callerCanOverrideLocked)
    {
        var seenUnits = new HashSet<Guid>();
        var rows = new List<MeterReadingRowResultDto>(request.Items.Count);
        foreach (var item in request.Items)
        {
            var errors = new List<MeterReadingIssueDto>();
            var warnings = new List<MeterReadingIssueDto>();
            if (!seenUnits.Add(item.UnitId))
            {
                errors.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.DuplicateUnit, null));
            }

            if (!contextsByUnitId.TryGetValue(item.UnitId, out var context))
            {
                errors.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.NoActiveLease, null));
                rows.Add(new MeterReadingRowResultDto(item.UnitId, null, false, null, null, errors, warnings));
                continue;
            }

            var isLockedOverride = false;
            if (context.IsLocked)
            {
                if (!callerCanOverrideLocked)
                {
                    errors.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.PeriodLocked, null));
                }
                else if (string.IsNullOrWhiteSpace(request.OverrideReason))
                {
                    errors.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.OverrideReasonRequired, null));
                }
                else
                {
                    isLockedOverride = true;
                }
            }

            var water = EvaluateUtility(context, UtilityType.Water, period, item.CurrentWaterReading, item.WaterRolloverConfirmed, waterTariff, errors, warnings);
            var electric = EvaluateUtility(context, UtilityType.Electric, period, item.CurrentElectricReading, item.ElectricRolloverConfirmed, electricTariff, errors, warnings);
            rows.Add(new MeterReadingRowResultDto(
                item.UnitId,
                context.UnitRef.UnitNumber,
                isLockedOverride,
                water,
                electric,
                errors,
                warnings));
        }

        return rows;
    }

    private static UtilityReadingResultDto? EvaluateUtility(
        LeaseMeterContext context,
        UtilityType utilityType,
        string period,
        decimal currentReading,
        bool rolloverConfirmed,
        PropertyUtilityTariff? tariff,
        List<MeterReadingIssueDto> errors,
        List<MeterReadingIssueDto> warnings)
    {
        var (previousReading, previousUsage) = MeterReadingRules.ResolvePrevious(context.Lease, utilityType, period, context.UnitReadings);
        return MeterReadingRules.Evaluate(
            utilityType,
            previousReading,
            previousUsage,
            currentReading,
            rolloverConfirmed,
            tariff,
            context.OccupantCount,
            errors,
            warnings);
    }

    // Returns a new reading to add, or null when the existing tracked reading was updated in place.
    internal static MeterReading? Upsert(
        MeterReading? existing,
        Guid propertyId,
        Guid unitId,
        UtilityType utilityType,
        string period,
        UtilityReadingResultDto result,
        bool rolloverConfirmed,
        string? photoFileKey)
    {
        var target = existing ?? new MeterReading
        {
            PropertyId = propertyId,
            UnitId = unitId,
            UtilityType = utilityType,
            BillingPeriodYearMonth = period,
            PreviousReading = result.PreviousReading,
            CurrentReading = result.CurrentReading,
            UsageUnits = result.UsageUnits,
            ChargeAmount = result.ChargeAmount
        };
        target.PreviousReading = result.PreviousReading;
        target.CurrentReading = result.CurrentReading;
        target.UsageUnits = result.UsageUnits;
        target.ChargeAmount = result.ChargeAmount;
        target.IsRolloverConfirmed = result.UsedRollover && rolloverConfirmed;
        target.PhotoFileKey = string.IsNullOrWhiteSpace(photoFileKey) ? target.PhotoFileKey : photoFileKey.Trim();
        return existing is null ? target : null;
    }

    internal static Invoice BuildDraftInvoice(
        LeaseMeterContext context,
        string period,
        string documentNumber,
        MeterReading water,
        MeterReading electric,
        Func<string, TaxMode> taxModeForCategory)
    {
        var unitNumber = context.UnitRef.UnitNumber;
        var invoice = new Invoice
        {
            PropertyId = context.Lease.PropertyId,
            DocumentNumber = documentNumber,
            CustomerId = context.Lease.CustomerId,
            LeaseId = context.Lease.Id,
            BillingPeriodYearMonth = period
        };
        invoice.AddLine(
            $"ค่าเช่าห้อง {unitNumber} รอบบิล {period}",
            context.Lease.MonthlyRentAmount,
            taxModeForCategory(UtilityChargeCategories.MonthlyRoomRent),
            $"Room rent {unitNumber} ({period})");
        invoice.AddLine(
            $"ค่าน้ำประปา {water.UsageUnits:0.##} หน่วย ({water.PreviousReading:0.##} - {water.CurrentReading:0.##})",
            water.ChargeAmount,
            taxModeForCategory(UtilityChargeCategories.Water),
            $"Water {water.UsageUnits:0.##} units ({water.PreviousReading:0.##} - {water.CurrentReading:0.##})");
        invoice.AddLine(
            $"ค่าไฟฟ้า {electric.UsageUnits:0.##} หน่วย ({electric.PreviousReading:0.##} - {electric.CurrentReading:0.##})",
            electric.ChargeAmount,
            taxModeForCategory(UtilityChargeCategories.Electric),
            $"Electricity {electric.UsageUnits:0.##} units ({electric.PreviousReading:0.##} - {electric.CurrentReading:0.##})");
        return invoice;
    }

    internal static TaxMode ResolveTaxMode(IEnumerable<TaxProfile> propertyProfiles, string chargeCategoryCode) =>
        propertyProfiles.FirstOrDefault(p => p.IsActive && p.ChargeCategoryCode == chargeCategoryCode)?.TaxMode
        ?? TaxMode.Exempt;

    internal static InvoiceItemDto MapInvoice(
        Invoice invoice,
        Customer customer,
        UnitRefDto? unitRef,
        string? leaseDocumentNumber,
        bool unmaskPii) =>
        new(
            Id: invoice.Id,
            DocumentNumber: invoice.DocumentNumber,
            Status: invoice.Status.ToString(),
            BillingPeriodYearMonth: invoice.BillingPeriodYearMonth,
            Customer: new CustomerRefDto(
                customer.Id,
                customer.FullName,
                unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
            Unit: unitRef,
            LeaseDocumentNumber: leaseDocumentNumber,
            Lines: invoice.Lines.Select(l => new InvoiceLineDto(
                l.Id,
                LocalizedTextDto.FromDomain(l.Description),
                l.TaxMode.ToString(),
                l.LineAmount,
                l.SubTotal,
                l.VatAmount,
                l.NetAmount)).ToList(),
            SubTotal: invoice.SubTotal,
            TotalVatAmount: invoice.TotalVatAmount,
            TotalAmount: invoice.TotalAmount);

    internal static Error PropertyNotFound(Guid propertyId) =>
        new(DomainErrorCodes.ValidationFailed, $"Property '{propertyId}' was not found.");

    internal static Error InvoiceNotFound(Guid propertyId, Guid invoiceId) =>
        new(DomainErrorCodes.ValidationFailed, $"Invoice '{invoiceId}' was not found in property '{propertyId}'.");
}
