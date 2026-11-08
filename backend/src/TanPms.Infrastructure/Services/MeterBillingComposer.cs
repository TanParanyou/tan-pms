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

// A batch-generated invoice line before it is attached to an Invoice.
internal sealed record AutoInvoiceLine(
    LocalizedText Description,
    decimal Amount,
    TaxMode TaxMode,
    string ChargeCategoryCode);

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
        var invoice = new Invoice
        {
            PropertyId = context.Lease.PropertyId,
            DocumentNumber = documentNumber,
            CustomerId = context.Lease.CustomerId,
            LeaseId = context.Lease.Id,
            BillingPeriodYearMonth = period
        };
        foreach (var line in BuildAutoLines(context, period, water, electric, taxModeForCategory))
        {
            invoice.AddLine(line.Description, line.Amount, line.TaxMode, line.ChargeCategoryCode);
        }

        return invoice;
    }

    // Re-prices the batch-generated lines of a Draft invoice from current lease terms and readings.
    // Lines the user added stay untouched; an auto line the user deleted is not re-added. Returns false when nothing changed.
    internal static bool RefreshDraftInvoice(
        Invoice draft,
        IReadOnlyList<AutoInvoiceLine> autoLines,
        List<InvoiceLine> removedLines,
        List<InvoiceLine> addedLines)
    {
        foreach (var auto in autoLines)
        {
            var existing = draft.Lines.FirstOrDefault(l => l.ChargeCategoryCode == auto.ChargeCategoryCode);
            if (existing is null
                || (existing.LineAmount == decimal.Round(auto.Amount, 2, MidpointRounding.AwayFromZero)
                    && existing.TaxMode == auto.TaxMode
                    && existing.Description == auto.Description))
            {
                continue;
            }

            removedLines.Add(existing);
            addedLines.Add(draft.ReplaceLine(existing.Id, auto.Description, auto.Amount, auto.TaxMode));
        }

        return addedLines.Count > 0;
    }

    internal static List<AutoInvoiceLine> BuildAutoLines(
        LeaseMeterContext context,
        string period,
        MeterReading water,
        MeterReading electric,
        Func<string, TaxMode> taxModeForCategory)
    {
        var unitNumber = context.UnitRef.UnitNumber;
        BillingPeriod.Parse(period, out var periodStart, out var periodEnd);
        var (rentAmount, billableDays, daysInMonth) = ProrateMonthlyRent(context.Lease, periodStart, periodEnd);
        var rentDescription = billableDays == daysInMonth
            ? LocalizedText.Create($"ค่าเช่าห้อง {unitNumber} รอบบิล {period}", $"Room rent {unitNumber} ({period})")
            : LocalizedText.Create(
                $"ค่าเช่าห้อง {unitNumber} รอบบิล {period} (คิดตามจริง {billableDays}/{daysInMonth} วัน)",
                $"Room rent {unitNumber} ({period}, prorated {billableDays}/{daysInMonth} days)");
        return
        [
            new(rentDescription, rentAmount, taxModeForCategory(UtilityChargeCategories.MonthlyRoomRent), UtilityChargeCategories.MonthlyRoomRent),
            new(
                LocalizedText.Create(
                    $"ค่าน้ำประปา {water.UsageUnits:0.##} หน่วย ({water.PreviousReading:0.##} - {water.CurrentReading:0.##})",
                    $"Water {water.UsageUnits:0.##} units ({water.PreviousReading:0.##} - {water.CurrentReading:0.##})"),
                water.ChargeAmount,
                taxModeForCategory(UtilityChargeCategories.Water),
                UtilityChargeCategories.Water),
            new(
                LocalizedText.Create(
                    $"ค่าไฟฟ้า {electric.UsageUnits:0.##} หน่วย ({electric.PreviousReading:0.##} - {electric.CurrentReading:0.##})",
                    $"Electricity {electric.UsageUnits:0.##} units ({electric.PreviousReading:0.##} - {electric.CurrentReading:0.##})"),
                electric.ChargeAmount,
                taxModeForCategory(UtilityChargeCategories.Electric),
                UtilityChargeCategories.Electric)
        ];
    }

    // คิดค่าเช่าตามจำนวนวันจริงเมื่อสัญญาเริ่มหรือสิ้นสุดกลางรอบบิล:
    // ProratedRent = round(MonthlyRent x BillableDays / DaysInMonth, 2)
    // BillableDays = calendar days from max(StartDate, PeriodStart) to min(EndDate, PeriodEnd), inclusive.
    internal static (decimal Amount, int BillableDays, int DaysInMonth) ProrateMonthlyRent(Lease lease, DateOnly periodStart, DateOnly periodEnd)
    {
        var daysInMonth = periodEnd.DayNumber - periodStart.DayNumber + 1;
        var from = lease.StartDate > periodStart ? lease.StartDate : periodStart;
        var to = lease.EndDate < periodEnd ? lease.EndDate : periodEnd;
        var billableDays = Math.Clamp(to.DayNumber - from.DayNumber + 1, 0, daysInMonth);
        var amount = billableDays == daysInMonth
            ? lease.MonthlyRentAmount
            : decimal.Round(lease.MonthlyRentAmount * billableDays / daysInMonth, 2, MidpointRounding.AwayFromZero);
        return (amount, billableDays, daysInMonth);
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
            TotalAmount: invoice.TotalAmount,
            VoidReason: invoice.VoidReason);

    // Unlocked periods need only the record permission; a locked period needs the override permission plus a reason.
    internal static Error? CheckDeletable(LeaseMeterContext? context, int readingCount, string? overrideReason, bool callerCanOverrideLocked)
    {
        if (context is null)
        {
            return new Error(DomainErrorCodes.ValidationFailed, "Unit has no billable lease in this period.");
        }

        if (readingCount == 0)
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Unit {context.UnitRef.UnitNumber} has no saved meter readings in this period.");
        }

        if (!context.IsLocked)
        {
            return null;
        }

        if (!callerCanOverrideLocked)
        {
            return new Error(DomainErrorCodes.PermissionDenied, "Meter readings of an invoiced (locked) period require the override permission to delete.");
        }

        return string.IsNullOrWhiteSpace(overrideReason)
            ? new Error(DomainErrorCodes.ValidationFailed, "OverrideReason is required to delete readings of a locked period.")
            : null;
    }

    // Void is allowed only on an issued invoice without any money attached (receipts, or slips not yet rejected).
    internal static Error? CheckVoidable(Invoice invoice, bool hasReceipts, bool hasOpenSlips)
    {
        if (hasReceipts)
        {
            return new Error(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {invoice.DocumentNumber} has receipts and cannot be voided; issue a credit note or refund instead.");
        }

        return hasOpenSlips
            ? new Error(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {invoice.DocumentNumber} has pending or approved payment slips; reject pending slips before voiding.")
            : null;
    }

    internal static Error? ParseLineRequest(InvoiceLineRequest request, out LocalizedText description, out TaxMode taxMode)
    {
        description = LocalizedText.Create("-");
        taxMode = TaxMode.Exempt;
        if (request.LineAmount < 0m)
        {
            return new Error(DomainErrorCodes.ValidationFailed, "LineAmount cannot be negative.");
        }

        if (!Enum.TryParse(request.TaxMode, ignoreCase: true, out taxMode) || !Enum.IsDefined(taxMode))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid TaxMode '{request.TaxMode}'.");
        }

        try
        {
            description = LocalizedText.Create(request.Description?.Th ?? string.Empty, request.Description?.En);
            return null;
        }
        catch (DomainRuleException ex)
        {
            return new Error(ex.ErrorCode, ex.Message);
        }
    }

    internal static Error PropertyNotFound(Guid propertyId) =>
        new(DomainErrorCodes.ValidationFailed, $"Property '{propertyId}' was not found.");

    internal static Error InvoiceNotFound(Guid propertyId, Guid invoiceId) =>
        new(DomainErrorCodes.ValidationFailed, $"Invoice '{invoiceId}' was not found in property '{propertyId}'.");
}
