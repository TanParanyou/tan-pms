using TanPms.Application.Common.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Meters;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Notifications;
using TanPms.Domain.Rates;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<MeterReadingSheetResponse> GetAdminMeterReadingSheet(Guid propertyId, string period, Guid? buildingId)
    {
        if (BillingPeriod.Parse(period, out var start, out var end) is { } periodError)
        {
            return Result<MeterReadingSheetResponse>.Failure(periodError);
        }

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<MeterReadingSheetResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var normalizedPeriod = BillingPeriod.Format(start);
        var water = FindTariff(propertyId, UtilityType.Water);
        var electric = FindTariff(propertyId, UtilityType.Electric);
        var rows = BuildLeaseMeterContexts(propertyId, normalizedPeriod, start, end, buildingId)
            .Select(c => MeterBillingComposer.BuildSheetRow(c, normalizedPeriod, water, electric))
            .ToList();
        return Result<MeterReadingSheetResponse>.Success(new MeterReadingSheetResponse(normalizedPeriod, rows));
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

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<SaveMeterReadingsResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var period = BillingPeriod.Format(start);
        using var tx = BeginTransactionIfNeeded();

        var contexts = BuildLeaseMeterContexts(propertyId, period, start, end, buildingId: null)
            .ToDictionary(c => c.UnitRef.Id);
        var rows = MeterBillingComposer.EvaluateSave(
            request,
            period,
            contexts,
            FindTariff(propertyId, UtilityType.Water),
            FindTariff(propertyId, UtilityType.Electric),
            callerCanOverrideLocked);

        var isSaved = rows.All(r => r.Errors.Count == 0);
        if (isSaved)
        {
            var unitIds = rows.Select(r => r.UnitId).ToList();
            var existing = _dbContext.MeterReadings
                .Where(r => r.PropertyId == propertyId && r.BillingPeriodYearMonth == period && unitIds.Contains(r.UnitId))
                .ToList();
            foreach (var (row, item) in rows.Zip(request.Items))
            {
                UpsertReading(existing, propertyId, row.UnitId, UtilityType.Water, period, row.Water!, item.WaterRolloverConfirmed, item.WaterPhotoFileKey);
                UpsertReading(existing, propertyId, row.UnitId, UtilityType.Electric, period, row.Electric!, item.ElectricRolloverConfirmed, item.ElectricPhotoFileKey);
            }

            _dbContext.SaveChanges();
            tx?.Commit();
        }

        return Result<SaveMeterReadingsResponse>.Success(new SaveMeterReadingsResponse(period, isSaved, rows));
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

        var property = _dbContext.Properties.AsNoTracking().FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<BatchInvoiceRunResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var period = BillingPeriod.Format(start);
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        using var tx = BeginTransactionIfNeeded();

        var profiles = _dbContext.TaxProfiles.AsNoTracking().Where(p => p.PropertyId == propertyId).ToList();
        var contexts = BuildLeaseMeterContexts(propertyId, period, start, end, request.BuildingId);
        var leaseIds = contexts.Select(c => c.Lease.Id).ToList();
        // Tracked so Draft invoices of the period can be re-priced in place; Issued (or later) invoices are never touched.
        var liveInvoices = _dbContext.Invoices
            .Include(i => i.Lines)
            .Where(i => i.LeaseId != null
                        && leaseIds.Contains(i.LeaseId.Value)
                        && i.BillingPeriodYearMonth == period
                        && i.Status != InvoiceStatus.Voided)
            .ToList()
            .ToDictionary(i => i.LeaseId!.Value);

        var created = new List<(Invoice Invoice, LeaseMeterContext Context)>();
        var refreshed = new List<(Invoice Invoice, LeaseMeterContext Context)>();
        var skipped = new List<BatchInvoiceSkipDto>();
        foreach (var context in contexts)
        {
            var water = context.UnitReadings.FirstOrDefault(r => r.UtilityType == UtilityType.Water && r.BillingPeriodYearMonth == period);
            var electric = context.UnitReadings.FirstOrDefault(r => r.UtilityType == UtilityType.Electric && r.BillingPeriodYearMonth == period);
            liveInvoices.TryGetValue(context.Lease.Id, out var existing);
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
                var removedLines = new List<InvoiceLine>();
                var addedLines = new List<InvoiceLine>();
                if (existing.Status == InvoiceStatus.Draft
                    && MeterBillingComposer.RefreshDraftInvoice(
                        existing,
                        MeterBillingComposer.BuildAutoLines(context, period, water, electric, category => MeterBillingComposer.ResolveTaxMode(profiles, category)),
                        removedLines,
                        addedLines))
                {
                    _dbContext.Set<InvoiceLine>().RemoveRange(removedLines);
                    _dbContext.Set<InvoiceLine>().AddRange(addedLines);
                    refreshed.Add((existing, context));
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
                _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.INV, clockUtc).GetAwaiter().GetResult(),
                water,
                electric,
                category => MeterBillingComposer.ResolveTaxMode(profiles, category));
            _dbContext.Invoices.Add(invoice);
            _dbContext.Set<InvoiceLine>().AddRange(invoice.Lines);
            created.Add((invoice, context));
        }

        try
        {
            _dbContext.SaveChanges();
            tx?.Commit();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
        {
            return Result<BatchInvoiceRunResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Another batch invoice run for {period} completed concurrently. Reload and retry."));
        }

        return Result<BatchInvoiceRunResponse>.Success(new BatchInvoiceRunResponse(
            period,
            created.Select(c => MeterBillingComposer.MapInvoice(
                c.Invoice, c.Context.Customer, c.Context.UnitRef, c.Context.Lease.DocumentNumber, unmaskPii: false)).ToList(),
            refreshed.Select(c => MeterBillingComposer.MapInvoice(
                c.Invoice, c.Context.Customer, c.Context.UnitRef, c.Context.Lease.DocumentNumber, unmaskPii: false)).ToList(),
            skipped));
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

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<InvoiceListResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var query = _dbContext.Invoices
            .AsNoTracking()
            .Include(i => i.Lines)
            .Where(i => i.PropertyId == propertyId);
        if (periodFilter is not null)
        {
            query = query.Where(i => i.BillingPeriodYearMonth == periodFilter);
        }

        if (statusFilter.HasValue)
        {
            query = query.Where(i => i.Status == statusFilter.Value);
        }

        var (invoices, pagination) = query.OrderByDescending(i => i.DocumentNumber).ToPage(paging);
        return Result<InvoiceListResponse>.Success(new InvoiceListResponse(MapInvoices(propertyId, invoices, unmaskPii), pagination));
    }

    public Result<InvoiceIssueResponse> IssueAdminInvoicesForPeriod(Guid propertyId, IssueInvoicesRequest request)
    {
        if (BillingPeriod.Parse(request.Period, out var start, out _) is { } periodError)
        {
            return Result<InvoiceIssueResponse>.Failure(periodError);
        }

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<InvoiceIssueResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var period = BillingPeriod.Format(start);
        using var tx = BeginTransactionIfNeeded();
        var drafts = _dbContext.Invoices
            .Include(i => i.Lines)
            .Where(i => i.PropertyId == propertyId && i.BillingPeriodYearMonth == period && i.Status == InvoiceStatus.Draft)
            .ToList();
        foreach (var invoice in drafts)
        {
            IssueTracked(invoice);
        }

        _dbContext.SaveChanges();
        tx?.Commit();
        return Result<InvoiceIssueResponse>.Success(new InvoiceIssueResponse(MapInvoices(propertyId, drafts, unmaskPii: false)));
    }

    public Result<InvoiceItemDto> IssueAdminInvoice(Guid propertyId, Guid invoiceId)
    {
        var invoice = _dbContext.Invoices
            .Include(i => i.Lines)
            .FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
        if (invoice is null)
        {
            return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
        }

        try
        {
            IssueTracked(invoice);
            _dbContext.SaveChanges();
            return Result<InvoiceItemDto>.Success(MapInvoices(propertyId, [invoice], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<InvoiceItemDto> DeleteAdminInvoice(Guid propertyId, Guid invoiceId)
    {
        var invoice = _dbContext.Invoices
            .Include(i => i.Lines)
            .FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
        if (invoice is null)
        {
            return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
        }

        try
        {
            invoice.EnsureCanDelete();
            var dto = MapInvoices(propertyId, [invoice], unmaskPii: false)[0];
            // AuditableEntityInterceptor soft-deletes the invoice; keep its lines instead of cascading a hard delete.
            _dbContext.Invoices.Remove(invoice);
            foreach (var line in invoice.Lines)
            {
                _dbContext.Entry(line).State = EntityState.Unchanged;
            }

            _dbContext.SaveChanges();
            return Result<InvoiceItemDto>.Success(dto);
        }
        catch (DomainRuleException ex)
        {
            return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
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
        using var tx = BeginTransactionIfNeeded();
        var context = BuildLeaseMeterContexts(propertyId, normalizedPeriod, start, end, buildingId: null)
            .FirstOrDefault(c => c.UnitRef.Id == unitId);
        var readings = _dbContext.MeterReadings
            .Where(r => r.PropertyId == propertyId && r.UnitId == unitId && r.BillingPeriodYearMonth == normalizedPeriod)
            .ToList();
        if (MeterBillingComposer.CheckDeletable(context, readings.Count, overrideReason, callerCanOverrideLocked) is { } deleteError)
        {
            return Result<MeterReadingSheetRowDto>.Failure(deleteError);
        }

        // AuditableEntityInterceptor turns these removals into soft deletes.
        _dbContext.MeterReadings.RemoveRange(readings);
        _dbContext.SaveChanges();
        tx?.Commit();

        var refreshed = BuildLeaseMeterContexts(propertyId, normalizedPeriod, start, end, buildingId: null).First(c => c.UnitRef.Id == unitId);
        return Result<MeterReadingSheetRowDto>.Success(MeterBillingComposer.BuildSheetRow(
            refreshed,
            normalizedPeriod,
            FindTariff(propertyId, UtilityType.Water),
            FindTariff(propertyId, UtilityType.Electric)));
    }

    public Result<InvoiceItemDto> GetAdminInvoice(Guid propertyId, Guid invoiceId, bool unmaskPii = false)
    {
        var invoice = _dbContext.Invoices
            .AsNoTracking()
            .Include(i => i.Lines)
            .FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
        return invoice is null
            ? Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId))
            : Result<InvoiceItemDto>.Success(MapInvoices(propertyId, [invoice], unmaskPii)[0]);
    }

    public Result<InvoiceItemDto> AddAdminInvoiceLine(Guid propertyId, Guid invoiceId, InvoiceLineRequest request) =>
        MutateDraftInvoiceLines(propertyId, invoiceId, request, (invoice, description, taxMode) =>
            ([], [invoice.AddLine(description, request.LineAmount, taxMode)]));

    public Result<InvoiceItemDto> UpdateAdminInvoiceLine(Guid propertyId, Guid invoiceId, Guid lineId, InvoiceLineRequest request) =>
        MutateDraftInvoiceLines(propertyId, invoiceId, request, (invoice, description, taxMode) =>
        {
            var old = invoice.Lines.FirstOrDefault(l => l.Id == lineId);
            var replacement = invoice.ReplaceLine(lineId, description, request.LineAmount, taxMode);
            return ([old!], [replacement]);
        });

    public Result<InvoiceItemDto> DeleteAdminInvoiceLine(Guid propertyId, Guid invoiceId, Guid lineId) =>
        MutateDraftInvoiceLines(propertyId, invoiceId, request: null, (invoice, _, _) =>
            ([invoice.RemoveLine(lineId)], []));

    public Result<InvoiceItemDto> VoidAdminInvoice(Guid propertyId, Guid invoiceId, ReasonRequest request)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<InvoiceItemDto>.Failure(reasonError);
        }

        using var tx = BeginTransactionIfNeeded();
        LockInvoiceRow(invoiceId);
        var invoice = _dbContext.Invoices
            .Include(i => i.Lines)
            .FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
        if (invoice is null)
        {
            return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
        }

        _dbContext.Entry(invoice).Reload();
        var hasReceipts = _dbContext.Receipts.AsNoTracking().Any(r => r.InvoiceId == invoice.Id);
        var hasOpenSlips = _dbContext.PaymentSlips.AsNoTracking()
            .Any(s => s.InvoiceId == invoice.Id && s.Status != PaymentSlipStatus.Rejected);
        if (MeterBillingComposer.CheckVoidable(invoice, hasReceipts, hasOpenSlips) is { } voidError)
        {
            return Result<InvoiceItemDto>.Failure(voidError);
        }

        try
        {
            invoice.Void(request.Reason.Trim());
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<InvoiceItemDto>.Success(MapInvoices(propertyId, [invoice], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private Result<InvoiceItemDto> MutateDraftInvoiceLines(
        Guid propertyId,
        Guid invoiceId,
        InvoiceLineRequest? request,
        Func<Invoice, LocalizedText, TaxMode, (List<InvoiceLine> Removed, List<InvoiceLine> Added)> mutate)
    {
        LocalizedText description = LocalizedText.Create("-");
        var taxMode = TaxMode.Exempt;
        if (request is not null && MeterBillingComposer.ParseLineRequest(request, out description, out taxMode) is { } requestError)
        {
            return Result<InvoiceItemDto>.Failure(requestError);
        }

        var invoice = _dbContext.Invoices
            .Include(i => i.Lines)
            .FirstOrDefault(i => i.Id == invoiceId && i.PropertyId == propertyId);
        if (invoice is null)
        {
            return Result<InvoiceItemDto>.Failure(MeterBillingComposer.InvoiceNotFound(propertyId, invoiceId));
        }

        try
        {
            var (removed, added) = mutate(invoice, description, taxMode);
            _dbContext.Set<InvoiceLine>().RemoveRange(removed);
            _dbContext.Set<InvoiceLine>().AddRange(added);
            _dbContext.SaveChanges();
            return Result<InvoiceItemDto>.Success(MapInvoices(propertyId, [invoice], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<InvoiceItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<BillingSettingsDto> GetBillingSettings(Guid propertyId)
    {
        var property = _dbContext.Properties.AsNoTracking().FirstOrDefault(p => p.Id == propertyId);
        return property is null
            ? Result<BillingSettingsDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId))
            : Result<BillingSettingsDto>.Success(new BillingSettingsDto(property.Id, property.PaymentTermsDays, property.EffectivePaymentTermsDays));
    }

    public Result<BillingSettingsDto> UpdateBillingSettings(Guid propertyId, UpdateBillingSettingsRequest request)
    {
        var property = _dbContext.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<BillingSettingsDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        property.PaymentTermsDays = request.PaymentTermsDays;
        _dbContext.SaveChanges();
        return Result<BillingSettingsDto>.Success(new BillingSettingsDto(property.Id, property.PaymentTermsDays, property.EffectivePaymentTermsDays));
    }

    public int MarkOverdueInvoices(DateTimeOffset nowUtc)
    {
        var today = AnalyticsPeriod.LocalDate(nowUtc);
        var candidates = _dbContext.Invoices.Include(i => i.Lines)
            .Where(i => ((i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid) && i.DueDate != null && i.DueDate < today)
                        || (i.Status == InvoiceStatus.Overdue && i.OverdueNotifiedAt == null))
            .ToList();
        var flipped = candidates.Count(i => i.MarkOverdueIfPastDue(today));
        foreach (var invoice in candidates.Where(i => i.TryMarkOverdueNotified(nowUtc)))
        {
            _dbContext.NotificationMessages.Add(MeterBillingComposer.BuildOverdueNotification(invoice, nowUtc));
        }

        _dbContext.SaveChanges();
        return flipped;
    }

    private void IssueTracked(Invoice invoice)
    {
        var issuedAt = DateTimeOffset.UtcNow;
        var terms = _dbContext.Properties.AsNoTracking().Where(p => p.Id == invoice.PropertyId).Select(p => p.PaymentTermsDays).First();
        invoice.Issue(issuedAt, AnalyticsPeriod.LocalDate(issuedAt).AddDays(terms ?? Domain.Properties.Property.DefaultPaymentTermsDays));
        _dbContext.NotificationMessages.Add(new NotificationMessage
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

    private List<LeaseMeterContext> BuildLeaseMeterContexts(
        Guid propertyId,
        string period,
        DateOnly start,
        DateOnly end,
        Guid? buildingId)
    {
        var leases = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId)
            .ToList()
            .Where(l => MeterReadingRules.IsLeaseBillableInPeriod(l, start, end))
            .ToList();
        if (leases.Count == 0)
        {
            return [];
        }

        var unitIds = leases.Select(l => l.UnitId).Distinct().ToList();
        var leaseIds = leases.Select(l => l.Id).ToList();
        var customerIds = leases.Select(l => l.CustomerId).Distinct().ToList();

        var units = _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToList()
            .Where(u => !buildingId.HasValue || u.BuildingId == buildingId.Value)
            .ToDictionary(u => u.Id);
        var unitRefs = BuildUnitRefsForProperty(propertyId, units.Values.ToList());
        var buildingCodes = _dbContext.Buildings.AsNoTracking().Where(b => b.PropertyId == propertyId).ToDictionary(b => b.Id, b => b.Code);
        var floorNumbers = _dbContext.Floors.AsNoTracking().Where(f => f.PropertyId == propertyId).ToDictionary(f => f.Id, f => f.FloorNumber);
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);
        var occupantCounts = _dbContext.Occupants.AsNoTracking()
            .Where(o => o.LeaseId != null && leaseIds.Contains(o.LeaseId.Value))
            .GroupBy(o => o.LeaseId!.Value)
            .Select(g => new { LeaseId = g.Key, Count = g.Count() })
            .ToDictionary(x => x.LeaseId, x => x.Count);
        var readings = _dbContext.MeterReadings.AsNoTracking()
            .Where(r => unitIds.Contains(r.UnitId))
            .ToList()
            .ToLookup(r => r.UnitId);
        var lockedLeaseIds = _dbContext.Invoices.AsNoTracking()
            .Where(i => i.LeaseId != null && leaseIds.Contains(i.LeaseId.Value) && i.BillingPeriodYearMonth == period)
            .ToList()
            .Where(MeterReadingRules.LocksPeriod)
            .Select(i => i.LeaseId!.Value)
            .ToHashSet();

        return leases
            .Where(l => units.ContainsKey(l.UnitId))
            .Select(l => (Lease: l, Unit: units[l.UnitId]))
            .OrderBy(x => buildingCodes.GetValueOrDefault(x.Unit.BuildingId, string.Empty), StringComparer.Ordinal)
            .ThenBy(x => floorNumbers.GetValueOrDefault(x.Unit.FloorId))
            .ThenBy(x => x.Unit.UnitNumber, StringComparer.Ordinal)
            .Select(x => new LeaseMeterContext(
                x.Lease,
                unitRefs[x.Unit.Id],
                customers[x.Lease.CustomerId],
                Math.Max(1, occupantCounts.GetValueOrDefault(x.Lease.Id)),
                readings[x.Unit.Id].ToList(),
                lockedLeaseIds.Contains(x.Lease.Id)))
            .ToList();
    }

    private void UpsertReading(
        List<Domain.Meters.MeterReading> trackedPeriodReadings,
        Guid propertyId,
        Guid unitId,
        UtilityType utilityType,
        string period,
        UtilityReadingResultDto result,
        bool rolloverConfirmed,
        string? photoFileKey)
    {
        var existing = trackedPeriodReadings.FirstOrDefault(r => r.UnitId == unitId && r.UtilityType == utilityType);
        if (MeterBillingComposer.Upsert(existing, propertyId, unitId, utilityType, period, result, rolloverConfirmed, photoFileKey) is { } added)
        {
            _dbContext.MeterReadings.Add(added);
        }
    }

    private PropertyUtilityTariff? FindTariff(Guid propertyId, UtilityType utilityType) =>
        _dbContext.PropertyUtilityTariffs
            .AsNoTracking()
            .FirstOrDefault(t => t.PropertyId == propertyId && t.UtilityType == utilityType);

    private List<InvoiceItemDto> MapInvoices(Guid propertyId, IReadOnlyList<Invoice> invoices, bool unmaskPii)
    {
        var leaseIds = invoices.Where(i => i.LeaseId.HasValue).Select(i => i.LeaseId!.Value).Distinct().ToList();
        var stayIds = invoices.Where(i => i.StayId.HasValue).Select(i => i.StayId!.Value).Distinct().ToList();
        var customerIds = invoices.Select(i => i.CustomerId).Distinct().ToList();
        var leases = _dbContext.Leases.AsNoTracking().Where(l => leaseIds.Contains(l.Id)).ToDictionary(l => l.Id);
        var stayUnitIds = _dbContext.Stays.AsNoTracking().Where(s => stayIds.Contains(s.Id)).ToDictionary(s => s.Id, s => s.UnitId);
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);
        var unitIds = leases.Values.Select(l => l.UnitId).Concat(stayUnitIds.Values).Distinct().ToList();
        var unitRefs = BuildUnitRefsForProperty(
            propertyId,
            _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToList());

        return invoices.Select(invoice =>
        {
            var lease = invoice.LeaseId.HasValue ? leases.GetValueOrDefault(invoice.LeaseId.Value) : null;
            Guid? unitId = lease is not null
                ? lease.UnitId
                : invoice.StayId.HasValue && stayUnitIds.TryGetValue(invoice.StayId.Value, out var stayUnitId) ? stayUnitId : null;
            return MeterBillingComposer.MapInvoice(
                invoice,
                customers[invoice.CustomerId],
                unitId.HasValue ? unitRefs[unitId.Value] : null,
                lease?.DocumentNumber,
                unmaskPii);
        }).ToList();
    }
}
