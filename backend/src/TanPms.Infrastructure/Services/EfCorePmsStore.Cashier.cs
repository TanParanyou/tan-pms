using Microsoft.EntityFrameworkCore;
using Npgsql;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Payments;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<CashierShiftDto> OpenAdminCashierShift(
        Guid propertyId,
        string cashierUserId,
        OpenCashierShiftRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (CashierRequestValidation.ValidateOpen(request) is { } validationError)
        {
            return Result<CashierShiftDto>.Failure(validationError);
        }

        var property = _dbContext.Properties.AsNoTracking().FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<CashierShiftDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        if (FindOpenShift(propertyId, cashierUserId) is not null)
        {
            return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftAlreadyOpen());
        }

        var shift = new CashierShift
        {
            PropertyId = propertyId,
            DocumentNumber = _documentNumberService.NextDocumentNumberAsync(
                property.Id, property.Code, DocumentTypeCode.SHF, nowUtc ?? DateTimeOffset.UtcNow).GetAwaiter().GetResult(),
            CashierUserId = cashierUserId,
            OpeningFloatCash = decimal.Round(request.OpeningFloatCash, 2, MidpointRounding.AwayFromZero)
        };
        _dbContext.CashierShifts.Add(shift);
        try
        {
            _dbContext.SaveChanges();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            _dbContext.Entry(shift).State = EntityState.Detached;
            return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftAlreadyOpen());
        }

        return Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
    }

    public Result<CurrentCashierShiftResponse> GetCurrentAdminCashierShift(Guid propertyId, string cashierUserId)
    {
        var shift = FindOpenShift(propertyId, cashierUserId);
        return Result<CurrentCashierShiftResponse>.Success(new CurrentCashierShiftResponse(
            shift is null ? null : CashierRecordMapper.MapShift(shift)));
    }

    public Result<CashierShiftListResponse> GetAdminCashierShifts(Guid propertyId, string? status)
    {
        if (CashierRequestValidation.ParseShiftStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<CashierShiftListResponse>.Failure(statusError);
        }

        var query = _dbContext.CashierShifts.AsNoTracking().Where(s => s.PropertyId == propertyId);
        if (statusFilter.HasValue)
        {
            query = query.Where(s => s.Status == statusFilter.Value);
        }

        var items = query
            .OrderByDescending(s => s.DocumentNumber)
            .ToList()
            .Select(CashierRecordMapper.MapShift)
            .ToList();
        return Result<CashierShiftListResponse>.Success(new CashierShiftListResponse(items));
    }

    public Result<CashierShiftDto> CloseAdminCashierShift(
        Guid propertyId,
        Guid shiftId,
        string cashierUserId,
        CloseCashierShiftRequest request)
    {
        if (CashierRequestValidation.ValidateClose(request) is { } validationError)
        {
            return Result<CashierShiftDto>.Failure(validationError);
        }

        var shift = _dbContext.CashierShifts.FirstOrDefault(s => s.Id == shiftId && s.PropertyId == propertyId);
        if (shift is null)
        {
            return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftNotFound(propertyId, shiftId));
        }

        if (shift.CashierUserId != cashierUserId)
        {
            return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftOwnedByAnotherCashier());
        }

        try
        {
            shift.CloseShift(request.ActualCashCounted, request.VarianceRemark?.Trim());
            _dbContext.SaveChanges();
            return Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
        }
        catch (DomainRuleException ex)
        {
            return Result<CashierShiftDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<CashierShiftDto> ReconcileAdminCashierShift(Guid propertyId, Guid shiftId)
    {
        var shift = _dbContext.CashierShifts.FirstOrDefault(s => s.Id == shiftId && s.PropertyId == propertyId);
        if (shift is null)
        {
            return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftNotFound(propertyId, shiftId));
        }

        try
        {
            shift.MarkReconciled();
            _dbContext.SaveChanges();
            return Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
        }
        catch (DomainRuleException ex)
        {
            return Result<CashierShiftDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public bool HasOpenCashierShift(string cashierUserId, IReadOnlySet<Guid> propertyIds)
    {
        var ids = propertyIds.ToList();
        return _dbContext.CashierShifts.AsNoTracking().Any(s =>
            s.CashierUserId == cashierUserId && s.Status == CashierShiftStatus.Open && ids.Contains(s.PropertyId));
    }

    public Result<DepositLedgerListResponse> GetAdminDepositLedgers(Guid propertyId, string? depositType, bool unmaskPii = false)
    {
        if (CashierRequestValidation.ParseDepositType(depositType, out var typeFilter) is { } typeError)
        {
            return Result<DepositLedgerListResponse>.Failure(typeError);
        }

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<DepositLedgerListResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var query = _dbContext.DepositLedgers.AsNoTracking().Include(l => l.Transactions).Where(l => l.PropertyId == propertyId);
        if (typeFilter.HasValue)
        {
            query = query.Where(l => l.DepositType == typeFilter.Value);
        }

        var ledgers = query.OrderByDescending(l => l.CreatedAt).ToList();
        var stayIds = ledgers.Where(l => l.StayId.HasValue).Select(l => l.StayId!.Value).ToList();
        var leaseIds = ledgers.Where(l => l.LeaseId.HasValue).Select(l => l.LeaseId!.Value).ToList();
        var reservationIds = ledgers.Where(l => l.ReservationId.HasValue).Select(l => l.ReservationId!.Value).ToList();
        var customerIds = ledgers.Select(l => l.CustomerId).Distinct().ToList();

        var stays = _dbContext.Stays.AsNoTracking().Where(s => stayIds.Contains(s.Id))
            .ToDictionary(s => s.Id, s => (s.DocumentNumber, UnitId: (Guid?)s.UnitId));
        var leases = _dbContext.Leases.AsNoTracking().Where(l => leaseIds.Contains(l.Id))
            .ToDictionary(l => l.Id, l => (l.DocumentNumber, UnitId: (Guid?)l.UnitId));
        var reservations = _dbContext.Reservations.AsNoTracking().Where(r => reservationIds.Contains(r.Id))
            .ToDictionary(r => r.Id, r => (r.DocumentNumber, r.UnitId));
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);

        (string DocumentNumber, Guid? UnitId)? Owner(DepositLedger l) =>
            l.StayId.HasValue && stays.TryGetValue(l.StayId.Value, out var s) ? s
            : l.LeaseId.HasValue && leases.TryGetValue(l.LeaseId.Value, out var le) ? le
            : l.ReservationId.HasValue && reservations.TryGetValue(l.ReservationId.Value, out var r) ? r
            : null;

        var unitIds = ledgers.Select(Owner).Where(o => o?.UnitId is not null).Select(o => o!.Value.UnitId!.Value).Distinct().ToList();
        var unitRefs = BuildUnitRefsForProperty(propertyId, _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToList());

        var items = ledgers.Select(l =>
        {
            var owner = Owner(l);
            UnitRefDto? unitRef = owner?.UnitId is { } unitId ? unitRefs[unitId] : null;
            return CashierRecordMapper.MapLedger(l, owner?.DocumentNumber, customers[l.CustomerId], unitRef, unmaskPii);
        }).ToList();
        return Result<DepositLedgerListResponse>.Success(new DepositLedgerListResponse(items, items.Sum(i => i.CurrentBalance)));
    }

    public Result<ClientPaymentSlipDto> SubmitClientPaymentSlip(
        Guid customerId,
        Guid invoiceId,
        SubmitPaymentSlipRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (PaymentSlipRules.ValidateSubmit(request) is { } validationError)
        {
            return Result<ClientPaymentSlipDto>.Failure(validationError);
        }

        var invoice = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines).FirstOrDefault(i => i.Id == invoiceId);
        var outstanding = invoice is null ? 0m : Outstanding(invoice);
        if (PaymentSlipRules.CheckSubmittable(invoice, customerId, outstanding, request.Amount) is { } submitError)
        {
            return Result<ClientPaymentSlipDto>.Failure(submitError);
        }

        var slip = CashierRecordMapper.BuildSlip(invoice!, customerId, request);
        _dbContext.PaymentSlips.Add(slip);
        _dbContext.SaveChanges();
        return Result<ClientPaymentSlipDto>.Success(CashierRecordMapper.MapClientSlip(slip, invoice!.DocumentNumber));
    }

    public Result<ClientPaymentSlipListResponse> GetClientInvoiceSlips(Guid customerId, Guid invoiceId)
    {
        var invoice = _dbContext.Invoices.AsNoTracking().FirstOrDefault(i => i.Id == invoiceId);
        if (invoice is null || invoice.CustomerId != customerId)
        {
            return Result<ClientPaymentSlipListResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Invoice was not found for the current customer."));
        }

        var items = _dbContext.PaymentSlips.AsNoTracking()
            .Where(s => s.InvoiceId == invoiceId)
            .OrderByDescending(s => s.CreatedAt)
            .ToList()
            .Select(s => CashierRecordMapper.MapClientSlip(s, invoice.DocumentNumber))
            .ToList();
        return Result<ClientPaymentSlipListResponse>.Success(new ClientPaymentSlipListResponse(items));
    }

    public Result<PaymentSlipQueueResponse> GetAdminPaymentSlips(Guid propertyId, string? status, bool unmaskPii = false)
    {
        if (PaymentSlipRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<PaymentSlipQueueResponse>.Failure(statusError);
        }

        var query = _dbContext.PaymentSlips.AsNoTracking().Where(s => s.PropertyId == propertyId);
        if (statusFilter.HasValue)
        {
            query = query.Where(s => s.Status == statusFilter.Value);
        }

        var slips = query.OrderBy(s => s.CreatedAt).ToList();
        return Result<PaymentSlipQueueResponse>.Success(new PaymentSlipQueueResponse(MapAdminSlips(propertyId, slips, unmaskPii)));
    }

    public Result<AdminPaymentSlipDto> ApproveAdminPaymentSlip(
        Guid propertyId,
        Guid slipId,
        string reviewerUserId,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        using var tx = BeginTransactionIfNeeded();

        // Row locks serialize concurrent approvals of the same slip and payments to the same invoice.
        LockPaymentSlipRow(slipId);
        var slip = _dbContext.PaymentSlips.FirstOrDefault(s => s.Id == slipId && s.PropertyId == propertyId);
        if (slip is null)
        {
            return Result<AdminPaymentSlipDto>.Failure(CashierRecordMapper.SlipNotFound(propertyId, slipId));
        }

        _dbContext.Entry(slip).Reload();
        LockInvoiceRow(slip.InvoiceId);
        var invoice = _dbContext.Invoices.Include(i => i.Lines).First(i => i.Id == slip.InvoiceId);
        _dbContext.Entry(invoice).Reload();
        var outstanding = Outstanding(invoice);
        if (slip.Status == PaymentSlipStatus.Pending
            && PaymentSlipRules.CheckSubmittable(invoice, slip.CustomerId, outstanding, slip.Amount) is { } payError)
        {
            return Result<AdminPaymentSlipDto>.Failure(payError);
        }

        try
        {
            slip.Approve(reviewerUserId, clockUtc);
            var property = _dbContext.Properties.AsNoTracking().First(p => p.Id == propertyId);
            var receipt = CashierRecordMapper.BuildSlipReceipt(
                invoice,
                slip,
                _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.RCT, clockUtc).GetAwaiter().GetResult());
            _dbContext.Receipts.Add(receipt);
            invoice.ApplyPayment(PaidToDate(invoice.Id) + receipt.NetPayableAmount);
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<AdminPaymentSlipDto>.Success(MapAdminSlips(propertyId, [slip], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<AdminPaymentSlipDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return Result<AdminPaymentSlipDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Payment slip was already approved by another reviewer."));
        }
    }

    public Result<AdminPaymentSlipDto> RejectAdminPaymentSlip(
        Guid propertyId,
        Guid slipId,
        string reviewerUserId,
        RejectPaymentSlipRequest request,
        DateTimeOffset? nowUtc = null)
    {
        using var tx = BeginTransactionIfNeeded();
        LockPaymentSlipRow(slipId);
        var slip = _dbContext.PaymentSlips.FirstOrDefault(s => s.Id == slipId && s.PropertyId == propertyId);
        if (slip is null)
        {
            return Result<AdminPaymentSlipDto>.Failure(CashierRecordMapper.SlipNotFound(propertyId, slipId));
        }

        _dbContext.Entry(slip).Reload();
        try
        {
            slip.Reject(reviewerUserId, request.Reason, nowUtc ?? DateTimeOffset.UtcNow);
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<AdminPaymentSlipDto>.Success(MapAdminSlips(propertyId, [slip], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<AdminPaymentSlipDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private CashierShift? FindOpenShift(Guid propertyId, string cashierUserId) =>
        _dbContext.CashierShifts.AsNoTracking().FirstOrDefault(s =>
            s.PropertyId == propertyId && s.CashierUserId == cashierUserId && s.Status == CashierShiftStatus.Open);

    private decimal PaidToDate(Guid invoiceId) =>
        _dbContext.Receipts.AsNoTracking().Where(r => r.InvoiceId == invoiceId).Sum(r => r.NetPayableAmount);

    private decimal Outstanding(Invoice invoice) =>
        PaymentSlipRules.Outstanding(invoice, _dbContext.Receipts.AsNoTracking().Where(r => r.InvoiceId == invoice.Id).ToList());

    private List<AdminPaymentSlipDto> MapAdminSlips(Guid propertyId, IReadOnlyList<PaymentSlip> slips, bool unmaskPii)
    {
        var invoiceIds = slips.Select(s => s.InvoiceId).Distinct().ToList();
        var slipIds = slips.Select(s => s.Id).ToList();
        var invoices = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines).Where(i => invoiceIds.Contains(i.Id)).ToList();
        var invoiceDtos = MapInvoices(propertyId, invoices, unmaskPii: false).ToDictionary(i => i.Id);
        var invoicesById = invoices.ToDictionary(i => i.Id);
        var receipts = _dbContext.Receipts.AsNoTracking().Where(r => invoiceIds.Contains(r.InvoiceId)).ToList();
        var customerIds = slips.Select(s => s.CustomerId).Distinct().ToList();
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);

        return slips.Select(slip =>
        {
            var invoice = invoicesById[slip.InvoiceId];
            return CashierRecordMapper.MapAdminSlip(
                slip,
                invoice,
                PaymentSlipRules.Outstanding(invoice, receipts.Where(r => r.InvoiceId == invoice.Id)),
                customers[slip.CustomerId],
                invoiceDtos[invoice.Id].Unit,
                receipts.FirstOrDefault(r => r.PaymentSlipId == slip.Id)?.DocumentNumber,
                unmaskPii);
        }).ToList();
    }

    private void LockPaymentSlipRow(Guid slipId)
    {
        if (_dbContext.Database.IsRelational())
        {
            _dbContext.Database.ExecuteSqlInterpolated(
                $"SELECT 1 FROM \"PaymentSlips\" WHERE \"Id\" = {slipId} FOR UPDATE");
        }
    }

    private void LockInvoiceRow(Guid invoiceId)
    {
        if (_dbContext.Database.IsRelational())
        {
            _dbContext.Database.ExecuteSqlInterpolated(
                $"SELECT 1 FROM \"Invoices\" WHERE \"Id\" = {invoiceId} FOR UPDATE");
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: "23505" };
}
