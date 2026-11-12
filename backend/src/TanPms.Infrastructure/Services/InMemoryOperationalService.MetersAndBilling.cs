using TanPms.Application.Common.Models;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Meters;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Meters;
using TanPms.Domain.Notifications;
using TanPms.Domain.Rates;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<MeterReading> _meterReadings = [];

    public Result<MeterReadingSheetResponse> GetAdminMeterReadingSheet(Guid propertyId, string period, Guid? buildingId)
    {
        if (BillingPeriod.Parse(period, out var start, out var end) is { } periodError)
        {
            return Result<MeterReadingSheetResponse>.Failure(periodError);
        }

        var normalizedPeriod = BillingPeriod.Format(start);
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<MeterReadingSheetResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var water = FindTariffLocked(propertyId, UtilityType.Water);
            var electric = FindTariffLocked(propertyId, UtilityType.Electric);
            var rows = BuildLeaseMeterContextsLocked(propertyId, normalizedPeriod, start, end, buildingId)
                .Select(c => MeterBillingComposer.BuildSheetRow(c, normalizedPeriod, water, electric))
                .ToList();
            return Result<MeterReadingSheetResponse>.Success(new MeterReadingSheetResponse(normalizedPeriod, rows));
        }
    }

    public Result<SaveMeterReadingsResponse> SaveAdminMeterReadings(
        Guid propertyId,
        SaveMeterReadingsRequest request,
        bool callerCanOverrideLocked)
    {
        if (BillingPeriod.Parse(request.Period, out var start, out var end) is { } periodError)
        {
            return Result<SaveMeterReadingsResponse>.Failure(periodError);
        }

        if (request.Items is not { Count: > 0 })
        {
            return Result<SaveMeterReadingsResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "At least one meter reading item is required."));
        }

        var period = BillingPeriod.Format(start);
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<SaveMeterReadingsResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var contexts = BuildLeaseMeterContextsLocked(propertyId, period, start, end, buildingId: null)
                .ToDictionary(c => c.UnitRef.Id);
            var rows = MeterBillingComposer.EvaluateSave(
                request,
                period,
                contexts,
                FindTariffLocked(propertyId, UtilityType.Water),
                FindTariffLocked(propertyId, UtilityType.Electric),
                callerCanOverrideLocked);

            var isSaved = rows.All(r => r.Errors.Count == 0);
            if (isSaved)
            {
                foreach (var (row, item) in rows.Zip(request.Items))
                {
                    UpsertReadingLocked(propertyId, row.UnitId, UtilityType.Water, period, row.Water!, item.WaterRolloverConfirmed, item.WaterPhotoFileKey);
                    UpsertReadingLocked(propertyId, row.UnitId, UtilityType.Electric, period, row.Electric!, item.ElectricRolloverConfirmed, item.ElectricPhotoFileKey);
                }
            }

            return Result<SaveMeterReadingsResponse>.Success(new SaveMeterReadingsResponse(period, isSaved, rows));
        }
    }

    public Result<BatchInvoiceRunResponse> RunAdminBatchInvoices(
        Guid propertyId,
        BatchInvoiceRunRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (BillingPeriod.Parse(request.Period, out var start, out var end) is { } periodError)
        {
            return Result<BatchInvoiceRunResponse>.Failure(periodError);
        }

        var period = BillingPeriod.Format(start);
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var property))
            {
                return Result<BatchInvoiceRunResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var profiles = _taxProfiles.Values.Where(p => p.PropertyId == propertyId).ToList();
            var created = new List<Invoice>();
            var refreshed = new List<Invoice>();
            var skipped = new List<BatchInvoiceSkipDto>();
            foreach (var context in BuildLeaseMeterContextsLocked(propertyId, period, start, end, request.BuildingId))
            {
                var water = context.UnitReadings.FirstOrDefault(r => r.UtilityType == UtilityType.Water && r.BillingPeriodYearMonth == period);
                var electric = context.UnitReadings.FirstOrDefault(r => r.UtilityType == UtilityType.Electric && r.BillingPeriodYearMonth == period);
                var existing = _invoices.FirstOrDefault(i =>
                    i.LeaseId == context.Lease.Id && i.BillingPeriodYearMonth == period && i.Status != InvoiceStatus.Voided);
                if (water is null || electric is null)
                {
                    skipped.Add(new BatchInvoiceSkipDto(
                        context.Lease.Id,
                        context.Lease.DocumentNumber,
                        context.UnitRef,
                        existing is not null && existing.Status != InvoiceStatus.Draft
                            ? BatchInvoiceSkipReasons.InvoiceAlreadyExists
                            : BatchInvoiceSkipReasons.MissingMeterReadings));
                    continue;
                }

                if (existing is not null)
                {
                    // Draft invoices of the period follow reading/lease changes; Issued (or later) are never touched.
                    if (existing.Status == InvoiceStatus.Draft
                        && MeterBillingComposer.RefreshDraftInvoice(
                            existing,
                            MeterBillingComposer.BuildAutoLines(context, period, water, electric, category => MeterBillingComposer.ResolveTaxRule(profiles, category)),
                            [],
                            []))
                    {
                        refreshed.Add(existing);
                    }
                    else
                    {
                        skipped.Add(new BatchInvoiceSkipDto(context.Lease.Id, context.Lease.DocumentNumber, context.UnitRef, BatchInvoiceSkipReasons.InvoiceAlreadyExists));
                    }

                    continue;
                }

                var invoice = MeterBillingComposer.BuildDraftInvoice(
                    context,
                    period,
                    NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.INV, clockUtc).GetAwaiter().GetResult(),
                    water,
                    electric,
                    category => MeterBillingComposer.ResolveTaxRule(profiles, category));
                _invoices.Add(invoice);
                created.Add(invoice);
            }

            return Result<BatchInvoiceRunResponse>.Success(new BatchInvoiceRunResponse(
                period,
                created.Select(i => MapInvoiceLocked(i, unmaskPii: false)).ToList(),
                refreshed.Select(i => MapInvoiceLocked(i, unmaskPii: false)).ToList(),
                skipped));
        }
    }

    public Result<InvoiceListResponse> GetAdminInvoices(
        Guid propertyId,
        string? period,
        string? status,
        bool unmaskPii = false,
        PageRequest? paging = null)
    {
        string? periodFilter = null;
        if (!string.IsNullOrWhiteSpace(period))
        {
            if (BillingPeriod.Parse(period, out var start, out _) is { } periodError)
            {
                return Result<InvoiceListResponse>.Failure(periodError);
            }

            periodFilter = BillingPeriod.Format(start);
        }

        InvoiceStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<InvoiceStatus>(status, ignoreCase: true, out var parsed))
            {
                return Result<InvoiceListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid InvoiceStatus '{status}'."));
            }

            statusFilter = parsed;
        }

        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<InvoiceListResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var items = _invoices
                .Where(i => i.PropertyId == propertyId
                            && (periodFilter is null || i.BillingPeriodYearMonth == periodFilter)
                            && (!statusFilter.HasValue || i.Status == statusFilter.Value))
                .OrderByDescending(i => i.DocumentNumber, StringComparer.Ordinal)
                .AsQueryable()
                .ToPage(paging);
            return Result<InvoiceListResponse>.Success(new InvoiceListResponse(items.Items.Select(i => MapInvoiceLocked(i, unmaskPii)).ToList(), items.Pagination));
        }
    }

    public Result<InvoiceIssueResponse> IssueAdminInvoicesForPeriod(Guid propertyId, IssueInvoicesRequest request)
    {
        if (BillingPeriod.Parse(request.Period, out var start, out _) is { } periodError)
        {
            return Result<InvoiceIssueResponse>.Failure(periodError);
        }

        var period = BillingPeriod.Format(start);
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<InvoiceIssueResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var drafts = _invoices
                .Where(i => i.PropertyId == propertyId && i.BillingPeriodYearMonth == period && i.Status == InvoiceStatus.Draft)
                .ToList();
            foreach (var invoice in drafts)
            {
                IssueLocked(invoice);
            }

            return Result<InvoiceIssueResponse>.Success(new InvoiceIssueResponse(
                drafts.Select(i => MapInvoiceLocked(i, unmaskPii: false)).ToList()));
        }
    }

    public Result<InvoiceItemDto> IssueAdminInvoice(Guid propertyId, Guid invoiceId)
    {
        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
            if (invoice is null)
            {
                return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
            }

            try
            {
                IssueLocked(invoice);
                return Result<InvoiceItemDto>.Success(MapInvoiceLocked(invoice, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<InvoiceItemDto> DeleteAdminInvoice(Guid propertyId, Guid invoiceId)
    {
        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
            if (invoice is null)
            {
                return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
            }

            try
            {
                invoice.EnsureCanDelete();
                var dto = MapInvoiceLocked(invoice, unmaskPii: false);
                _invoices.Remove(invoice);
                return Result<InvoiceItemDto>.Success(dto);
            }
            catch (DomainRuleException ex)
            {
                return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<MeterReadingSheetRowDto> DeleteAdminMeterReading(
        Guid propertyId,
        Guid unitId,
        string period,
        string? overrideReason,
        bool callerCanOverrideLocked)
    {
        if (BillingPeriod.Parse(period, out var start, out var end) is { } periodError)
        {
            return Result<MeterReadingSheetRowDto>.Failure(periodError);
        }

        var normalizedPeriod = BillingPeriod.Format(start);
        lock (_syncRoot)
        {
            var context = BuildLeaseMeterContextsLocked(propertyId, normalizedPeriod, start, end, buildingId: null)
                .FirstOrDefault(c => c.UnitRef.Id == unitId);
            var readings = _meterReadings
                .Where(r => r.PropertyId == propertyId && r.UnitId == unitId && r.BillingPeriodYearMonth == normalizedPeriod)
                .ToList();
            if (MeterBillingComposer.CheckDeletable(context, readings.Count, overrideReason, callerCanOverrideLocked) is { } deleteError)
            {
                return Result<MeterReadingSheetRowDto>.Failure(deleteError);
            }

            _meterReadings.RemoveAll(readings.Contains);
            var refreshed = BuildLeaseMeterContextsLocked(propertyId, normalizedPeriod, start, end, buildingId: null).First(c => c.UnitRef.Id == unitId);
            return Result<MeterReadingSheetRowDto>.Success(MeterBillingComposer.BuildSheetRow(
                refreshed,
                normalizedPeriod,
                FindTariffLocked(propertyId, UtilityType.Water),
                FindTariffLocked(propertyId, UtilityType.Electric)));
        }
    }

    public Result<InvoiceItemDto> GetAdminInvoice(Guid propertyId, Guid invoiceId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
            return invoice is null
                ? Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId))
                : Result<InvoiceItemDto>.Success(MapInvoiceLocked(invoice, unmaskPii));
        }
    }

    public Result<InvoiceItemDto> AddAdminInvoiceLine(Guid propertyId, Guid invoiceId, InvoiceLineRequest request) =>
        MutateDraftInvoiceLinesLocked(propertyId, invoiceId, request, (invoice, description, taxMode) =>
            invoice.AddLine(description, request.LineAmount, taxMode));

    public Result<InvoiceItemDto> UpdateAdminInvoiceLine(Guid propertyId, Guid invoiceId, Guid lineId, InvoiceLineRequest request) =>
        MutateDraftInvoiceLinesLocked(propertyId, invoiceId, request, (invoice, description, taxMode) =>
            invoice.ReplaceLine(lineId, description, request.LineAmount, taxMode));

    public Result<InvoiceItemDto> DeleteAdminInvoiceLine(Guid propertyId, Guid invoiceId, Guid lineId) =>
        MutateDraftInvoiceLinesLocked(propertyId, invoiceId, request: null, (invoice, _, _) => invoice.RemoveLine(lineId));

    public Result<InvoiceItemDto> VoidAdminInvoice(Guid propertyId, Guid invoiceId, ReasonRequest request)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<InvoiceItemDto>.Failure(reasonError);
        }

        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
            if (invoice is null)
            {
                return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
            }

            var hasReceipts = _receipts.Any(r => r.InvoiceId == invoice.Id);
            var hasOpenSlips = _paymentSlips.Any(s => s.InvoiceId == invoice.Id && s.Status != PaymentSlipStatus.Rejected);
            if (MeterBillingComposer.CheckVoidable(invoice, hasReceipts, hasOpenSlips) is { } voidError)
            {
                return Result<InvoiceItemDto>.Failure(voidError);
            }

            try
            {
                invoice.Void(request.Reason.Trim());
                Touch(invoice);
                return Result<InvoiceItemDto>.Success(MapInvoiceLocked(invoice, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private Result<InvoiceItemDto> MutateDraftInvoiceLinesLocked(
        Guid propertyId,
        Guid invoiceId,
        InvoiceLineRequest? request,
        Action<Invoice, LocalizedText, TaxMode> mutate)
    {
        LocalizedText description = LocalizedText.Create("-");
        var taxMode = TaxMode.Exempt;
        if (request is not null && MeterBillingComposer.ParseLineRequest(request, out description, out taxMode) is { } requestError)
        {
            return Result<InvoiceItemDto>.Failure(requestError);
        }

        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
            if (invoice is null)
            {
                return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
            }

            try
            {
                mutate(invoice, description, taxMode);
                Touch(invoice);
                return Result<InvoiceItemDto>.Success(MapInvoiceLocked(invoice, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<BillingSettingsDto> GetBillingSettings(Guid propertyId)
    {
        lock (_syncRoot)
        {
            return _properties.TryGetValue(propertyId, out var property)
                ? Result<BillingSettingsDto>.Success(new BillingSettingsDto(property.Id, property.PaymentTermsDays, property.EffectivePaymentTermsDays))
                : Result<BillingSettingsDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }
    }

    public Result<BillingSettingsDto> UpdateBillingSettings(Guid propertyId, UpdateBillingSettingsRequest request)
    {
        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var property))
            {
                return Result<BillingSettingsDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            property.PaymentTermsDays = request.PaymentTermsDays;
            Touch(property);
            return Result<BillingSettingsDto>.Success(new BillingSettingsDto(property.Id, property.PaymentTermsDays, property.EffectivePaymentTermsDays));
        }
    }

    public int MarkOverdueInvoices(DateTimeOffset nowUtc)
    {
        var today = AnalyticsPeriod.LocalDate(nowUtc);
        lock (_syncRoot)
        {
            var flipped = 0;
            foreach (var invoice in _invoices)
            {
                if (invoice.MarkOverdueIfPastDue(today))
                {
                    flipped++;
                    Touch(invoice, nowUtc);
                }

                if (invoice.TryMarkOverdueNotified(nowUtc))
                {
                    _notifications.Add(MeterBillingComposer.BuildOverdueNotification(invoice, nowUtc));
                }
            }

            return flipped;
        }
    }

    private void IssueLocked(Invoice invoice)
    {
        var issuedAt = DateTimeOffset.UtcNow;
        invoice.Issue(issuedAt, AnalyticsPeriod.LocalDate(issuedAt).AddDays(_properties[invoice.PropertyId].EffectivePaymentTermsDays));
        Touch(invoice);
        _notifications.Add(new NotificationMessage
        {
            PropertyId = invoice.PropertyId,
            CustomerId = invoice.CustomerId,
            Channel = NotificationChannel.InApp,
            TemplateKey = InvoiceIssuedNotification.TemplateKey,
            Title = InvoiceIssuedNotification.Title(invoice.DocumentNumber),
            Body = InvoiceIssuedNotification.Body(invoice.DocumentNumber, invoice.BillingPeriodYearMonth, invoice.TotalAmount),
            SentAtUtc = DateTimeOffset.UtcNow
        });
    }

    private List<LeaseMeterContext> BuildLeaseMeterContextsLocked(
        Guid propertyId,
        string period,
        DateOnly start,
        DateOnly end,
        Guid? buildingId)
    {
        return _leases
            .Where(l => l.PropertyId == propertyId && MeterReadingRules.IsLeaseBillableInPeriod(l, start, end))
            .Select(l => (Lease: l, Unit: _units[l.UnitId]))
            .Where(x => !buildingId.HasValue || x.Unit.BuildingId == buildingId.Value)
            .OrderBy(x => _buildings.TryGetValue(x.Unit.BuildingId, out var b) ? b.Code : string.Empty, StringComparer.Ordinal)
            .ThenBy(x => _floors.TryGetValue(x.Unit.FloorId, out var f) ? f.FloorNumber : 0)
            .ThenBy(x => x.Unit.UnitNumber, StringComparer.Ordinal)
            .Select(x => new LeaseMeterContext(
                x.Lease,
                _unitRefs[x.Unit.Id],
                _customers[x.Lease.CustomerId],
                Math.Max(1, _occupants.Count(o => o.LeaseId == x.Lease.Id)),
                _meterReadings.Where(r => r.UnitId == x.Unit.Id).ToList(),
                _invoices.Any(i => i.LeaseId == x.Lease.Id && i.BillingPeriodYearMonth == period && MeterReadingRules.LocksPeriod(i))))
            .ToList();
    }

    private void UpsertReadingLocked(
        Guid propertyId,
        Guid unitId,
        UtilityType utilityType,
        string period,
        UtilityReadingResultDto result,
        bool rolloverConfirmed,
        string? photoFileKey)
    {
        var existing = _meterReadings.FirstOrDefault(r =>
            r.UnitId == unitId && r.UtilityType == utilityType && r.BillingPeriodYearMonth == period);
        if (MeterBillingComposer.Upsert(existing, propertyId, unitId, utilityType, period, result, rolloverConfirmed, photoFileKey) is { } added)
        {
            _meterReadings.Add(added);
        }
    }

    private PropertyUtilityTariff? FindTariffLocked(Guid propertyId, UtilityType utilityType) =>
        _utilityTariffs.Values.FirstOrDefault(t => t.PropertyId == propertyId && t.UtilityType == utilityType);

    private InvoiceItemDto MapInvoiceLocked(Invoice invoice, bool unmaskPii)
    {
        var lease = invoice.LeaseId.HasValue ? _leases.FirstOrDefault(l => l.Id == invoice.LeaseId.Value) : null;
        var stay = invoice.StayId.HasValue ? _stays.FirstOrDefault(s => s.Id == invoice.StayId.Value) : null;
        Guid? unitId = lease?.UnitId ?? stay?.UnitId;
        return MeterBillingComposer.MapInvoice(
            invoice,
            _customers[invoice.CustomerId],
            unitId.HasValue ? _unitRefs[unitId.Value] : null,
            lease?.DocumentNumber,
            unmaskPii);
    }
}
