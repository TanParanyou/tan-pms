using TanPms.Application.Cashier;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Payments;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<CashierShift> _cashierShifts = [];
    private readonly List<PaymentSlip> _paymentSlips = [];
    private readonly List<Receipt> _receipts = [];

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

        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var property))
            {
                return Result<CashierShiftDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            if (FindOpenShiftLocked(propertyId, cashierUserId) is not null)
            {
                return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftAlreadyOpen());
            }

            var shift = new CashierShift
            {
                PropertyId = propertyId,
                DocumentNumber = NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.SHF, nowUtc ?? DateTimeOffset.UtcNow)
                    .GetAwaiter().GetResult(),
                CashierUserId = cashierUserId,
                OpeningFloatCash = decimal.Round(request.OpeningFloatCash, 2, MidpointRounding.AwayFromZero)
            };
            _cashierShifts.Add(shift);
            return Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
        }
    }

    public Result<CurrentCashierShiftResponse> GetCurrentAdminCashierShift(Guid propertyId, string cashierUserId)
    {
        lock (_syncRoot)
        {
            var shift = FindOpenShiftLocked(propertyId, cashierUserId);
            return Result<CurrentCashierShiftResponse>.Success(new CurrentCashierShiftResponse(
                shift is null ? null : CashierRecordMapper.MapShift(shift)));
        }
    }

    public Result<CashierShiftListResponse> GetAdminCashierShifts(Guid propertyId, string? status)
    {
        if (CashierRequestValidation.ParseShiftStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<CashierShiftListResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            var items = _cashierShifts
                .Where(s => s.PropertyId == propertyId && (!statusFilter.HasValue || s.Status == statusFilter.Value))
                .OrderByDescending(s => s.DocumentNumber, StringComparer.Ordinal)
                .Select(CashierRecordMapper.MapShift)
                .ToList();
            return Result<CashierShiftListResponse>.Success(new CashierShiftListResponse(items));
        }
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

        lock (_syncRoot)
        {
            var shift = _cashierShifts.FirstOrDefault(s => s.Id == shiftId && s.PropertyId == propertyId);
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
                return Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
            }
            catch (DomainRuleException ex)
            {
                return Result<CashierShiftDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<CashierShiftDto> ReconcileAdminCashierShift(Guid propertyId, Guid shiftId)
    {
        lock (_syncRoot)
        {
            var shift = _cashierShifts.FirstOrDefault(s => s.Id == shiftId && s.PropertyId == propertyId);
            if (shift is null)
            {
                return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftNotFound(propertyId, shiftId));
            }

            try
            {
                shift.MarkReconciled();
                return Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
            }
            catch (DomainRuleException ex)
            {
                return Result<CashierShiftDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<CashierShiftDto> GetAdminCashierShift(Guid propertyId, Guid shiftId)
    {
        lock (_syncRoot)
        {
            var shift = _cashierShifts.FirstOrDefault(s => s.Id == shiftId && s.PropertyId == propertyId);
            return shift is null
                ? Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftNotFound(propertyId, shiftId))
                : Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
        }
    }

    public Result<CashierShiftDto> CancelAdminCashierShift(
        Guid propertyId,
        Guid shiftId,
        string? requiredOwnerUserId,
        ReasonRequest request)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<CashierShiftDto>.Failure(reasonError);
        }

        return MutateShiftLocked(propertyId, shiftId, requiredOwnerUserId, shift =>
        {
            if (_receipts.Any(r => r.CashierShiftId == shift.Id))
            {
                return CashierRecordMapper.ShiftHasReceipts(shift.DocumentNumber);
            }

            shift.Cancel();
            return null;
        });
    }

    public Result<CashierShiftDto> UpdateAdminCashierShiftRemark(
        Guid propertyId,
        Guid shiftId,
        string? requiredOwnerUserId,
        UpdateCashierShiftRemarkRequest request) =>
        MutateShiftLocked(propertyId, shiftId, requiredOwnerUserId, shift =>
        {
            shift.UpdateVarianceRemark(request.VarianceRemark);
            return null;
        });

    private Result<CashierShiftDto> MutateShiftLocked(Guid propertyId, Guid shiftId, string? requiredOwnerUserId, Func<CashierShift, Error?> mutate)
    {
        lock (_syncRoot)
        {
            var shift = _cashierShifts.FirstOrDefault(s => s.Id == shiftId && s.PropertyId == propertyId);
            if (shift is null)
            {
                return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftNotFound(propertyId, shiftId));
            }

            if (requiredOwnerUserId is not null && shift.CashierUserId != requiredOwnerUserId)
            {
                return Result<CashierShiftDto>.Failure(CashierRecordMapper.ShiftOwnedByAnotherCashier());
            }

            try
            {
                return mutate(shift) is { } error
                    ? Result<CashierShiftDto>.Failure(error)
                    : Result<CashierShiftDto>.Success(CashierRecordMapper.MapShift(shift));
            }
            catch (DomainRuleException ex)
            {
                return Result<CashierShiftDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public bool HasOpenCashierShift(string cashierUserId, IReadOnlySet<Guid> propertyIds)
    {
        lock (_syncRoot)
        {
            return _cashierShifts.Any(s =>
                s.CashierUserId == cashierUserId && s.Status == CashierShiftStatus.Open && propertyIds.Contains(s.PropertyId));
        }
    }

    public Result<DepositLedgerListResponse> GetAdminDepositLedgers(Guid propertyId, string? depositType, bool unmaskPii = false)
    {
        if (CashierRequestValidation.ParseDepositType(depositType, out var typeFilter) is { } typeError)
        {
            return Result<DepositLedgerListResponse>.Failure(typeError);
        }

        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<DepositLedgerListResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var items = _depositLedgers
                .Where(l => l.PropertyId == propertyId && (!typeFilter.HasValue || l.DepositType == typeFilter.Value))
                .OrderByDescending(l => l.CreatedAt)
                .Select(l =>
                {
                    var (ownerDoc, unitId) = ResolveLedgerOwnerLocked(l);
                    return CashierRecordMapper.MapLedger(
                        l,
                        ownerDoc,
                        _customers[l.CustomerId],
                        unitId.HasValue ? _unitRefs[unitId.Value] : null,
                        unmaskPii);
                })
                .ToList();
            return Result<DepositLedgerListResponse>.Success(new DepositLedgerListResponse(items, items.Sum(i => i.CurrentBalance)));
        }
    }

    public Result<DepositLedgerItemDto> GetAdminDepositLedger(Guid propertyId, Guid ledgerId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            var ledger = _depositLedgers.FirstOrDefault(l => l.Id == ledgerId && l.PropertyId == propertyId);
            if (ledger is null)
            {
                return Result<DepositLedgerItemDto>.Failure(CashierRecordMapper.LedgerNotFound(propertyId, ledgerId));
            }

            var (ownerDoc, unitId) = ResolveLedgerOwnerLocked(ledger);
            return Result<DepositLedgerItemDto>.Success(CashierRecordMapper.MapLedger(
                ledger,
                ownerDoc,
                _customers[ledger.CustomerId],
                unitId.HasValue ? _unitRefs[unitId.Value] : null,
                unmaskPii));
        }
    }

    public Result<ClientPaymentSlipDto> UpdateClientPaymentSlip(
        Guid customerId,
        Guid invoiceId,
        Guid slipId,
        SubmitPaymentSlipRequest request)
    {
        if (PaymentSlipRules.ValidateSubmit(request) is { } validationError)
        {
            return Result<ClientPaymentSlipDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            var slip = _paymentSlips.FirstOrDefault(s => s.Id == slipId);
            if (PaymentSlipRules.CheckClientOwnsSlip(slip, customerId, invoiceId) is { } ownerError)
            {
                return Result<ClientPaymentSlipDto>.Failure(ownerError);
            }

            var invoice = _invoices.First(i => i.Id == invoiceId);
            if (PaymentSlipRules.CheckSubmittable(invoice, customerId, OutstandingLocked(invoice), request.Amount) is { } submitError)
            {
                return Result<ClientPaymentSlipDto>.Failure(submitError);
            }

            try
            {
                slip!.UpdatePending(request.Amount, request.SlipFileKey, request.TransferReference, request.TransferredAt);
                return Result<ClientPaymentSlipDto>.Success(CashierRecordMapper.MapClientSlip(slip, invoice.DocumentNumber));
            }
            catch (DomainRuleException ex)
            {
                return Result<ClientPaymentSlipDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<ClientPaymentSlipDto> WithdrawClientPaymentSlip(Guid customerId, Guid invoiceId, Guid slipId)
    {
        lock (_syncRoot)
        {
            var slip = _paymentSlips.FirstOrDefault(s => s.Id == slipId);
            if (PaymentSlipRules.CheckClientOwnsSlip(slip, customerId, invoiceId) is { } ownerError)
            {
                return Result<ClientPaymentSlipDto>.Failure(ownerError);
            }

            try
            {
                slip!.EnsureCanWithdraw();
                _paymentSlips.Remove(slip);
                return Result<ClientPaymentSlipDto>.Success(CashierRecordMapper.MapClientSlip(slip, _invoices.First(i => i.Id == invoiceId).DocumentNumber));
            }
            catch (DomainRuleException ex)
            {
                return Result<ClientPaymentSlipDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<AdminPaymentSlipDto> GetAdminPaymentSlip(Guid propertyId, Guid slipId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            var slip = _paymentSlips.FirstOrDefault(s => s.Id == slipId && s.PropertyId == propertyId);
            return slip is null
                ? Result<AdminPaymentSlipDto>.Failure(CashierRecordMapper.SlipNotFound(propertyId, slipId))
                : Result<AdminPaymentSlipDto>.Success(MapAdminSlipLocked(slip, unmaskPii));
        }
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

        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId);
            var outstanding = invoice is null ? 0m : OutstandingLocked(invoice);
            if (PaymentSlipRules.CheckSubmittable(invoice, customerId, outstanding, request.Amount) is { } submitError)
            {
                return Result<ClientPaymentSlipDto>.Failure(submitError);
            }

            var slip = CashierRecordMapper.BuildSlip(invoice!, customerId, request);
            _paymentSlips.Add(slip);
            return Result<ClientPaymentSlipDto>.Success(CashierRecordMapper.MapClientSlip(slip, invoice!.DocumentNumber));
        }
    }

    public Result<ClientPaymentSlipListResponse> GetClientInvoiceSlips(Guid customerId, Guid invoiceId)
    {
        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId);
            if (invoice is null || invoice.CustomerId != customerId)
            {
                return Result<ClientPaymentSlipListResponse>.Failure(new Error(
                    DomainErrorCodes.PermissionDenied,
                    "Invoice was not found for the current customer."));
            }

            var items = _paymentSlips
                .Where(s => s.InvoiceId == invoiceId)
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => CashierRecordMapper.MapClientSlip(s, invoice.DocumentNumber))
                .ToList();
            return Result<ClientPaymentSlipListResponse>.Success(new ClientPaymentSlipListResponse(items));
        }
    }

    public Result<PaymentSlipQueueResponse> GetAdminPaymentSlips(Guid propertyId, string? status, bool unmaskPii = false)
    {
        if (PaymentSlipRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<PaymentSlipQueueResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            var items = _paymentSlips
                .Where(s => s.PropertyId == propertyId && (!statusFilter.HasValue || s.Status == statusFilter.Value))
                .OrderBy(s => s.CreatedAt)
                .Select(s => MapAdminSlipLocked(s, unmaskPii))
                .ToList();
            return Result<PaymentSlipQueueResponse>.Success(new PaymentSlipQueueResponse(items));
        }
    }

    public Result<AdminPaymentSlipDto> ApproveAdminPaymentSlip(
        Guid propertyId,
        Guid slipId,
        string reviewerUserId,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            var slip = _paymentSlips.FirstOrDefault(s => s.Id == slipId && s.PropertyId == propertyId);
            if (slip is null)
            {
                return Result<AdminPaymentSlipDto>.Failure(CashierRecordMapper.SlipNotFound(propertyId, slipId));
            }

            var invoice = _invoices.First(i => i.Id == slip.InvoiceId);
            var outstanding = OutstandingLocked(invoice);
            if (slip.Status == PaymentSlipStatus.Pending
                && PaymentSlipRules.CheckSubmittable(invoice, slip.CustomerId, outstanding, slip.Amount) is { } payError)
            {
                return Result<AdminPaymentSlipDto>.Failure(payError);
            }

            try
            {
                slip.Approve(reviewerUserId, clockUtc);
                var property = _properties[propertyId];
                var receipt = CashierRecordMapper.BuildSlipReceipt(
                    invoice,
                    slip,
                    NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.RCT, clockUtc).GetAwaiter().GetResult());
                _receipts.Add(receipt);
                invoice.ApplyPayment(_receipts.Where(r => r.InvoiceId == invoice.Id).Sum(r => r.NetPayableAmount));
                return Result<AdminPaymentSlipDto>.Success(MapAdminSlipLocked(slip, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<AdminPaymentSlipDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<AdminPaymentSlipDto> RejectAdminPaymentSlip(
        Guid propertyId,
        Guid slipId,
        string reviewerUserId,
        RejectPaymentSlipRequest request,
        DateTimeOffset? nowUtc = null)
    {
        lock (_syncRoot)
        {
            var slip = _paymentSlips.FirstOrDefault(s => s.Id == slipId && s.PropertyId == propertyId);
            if (slip is null)
            {
                return Result<AdminPaymentSlipDto>.Failure(CashierRecordMapper.SlipNotFound(propertyId, slipId));
            }

            try
            {
                slip.Reject(reviewerUserId, request.Reason, nowUtc ?? DateTimeOffset.UtcNow);
                return Result<AdminPaymentSlipDto>.Success(MapAdminSlipLocked(slip, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<AdminPaymentSlipDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private CashierShift? FindOpenShiftLocked(Guid propertyId, string cashierUserId) =>
        _cashierShifts.FirstOrDefault(s =>
            s.PropertyId == propertyId && s.CashierUserId == cashierUserId && s.Status == CashierShiftStatus.Open);

    private decimal OutstandingLocked(Invoice invoice) =>
        PaymentSlipRules.Outstanding(invoice, _receipts.Where(r => r.InvoiceId == invoice.Id));

    private AdminPaymentSlipDto MapAdminSlipLocked(PaymentSlip slip, bool unmaskPii)
    {
        var invoice = _invoices.First(i => i.Id == slip.InvoiceId);
        return CashierRecordMapper.MapAdminSlip(
            slip,
            invoice,
            OutstandingLocked(invoice),
            _customers[slip.CustomerId],
            MapInvoiceLocked(invoice, unmaskPii: false).Unit,
            _receipts.FirstOrDefault(r => r.PaymentSlipId == slip.Id)?.DocumentNumber,
            unmaskPii);
    }

    private (string? OwnerDocumentNumber, Guid? UnitId) ResolveLedgerOwnerLocked(DepositLedger ledger)
    {
        if (ledger.StayId.HasValue && _stays.FirstOrDefault(s => s.Id == ledger.StayId.Value) is { } stay)
        {
            return (stay.DocumentNumber, stay.UnitId);
        }

        if (ledger.LeaseId.HasValue && _leases.FirstOrDefault(l => l.Id == ledger.LeaseId.Value) is { } lease)
        {
            return (lease.DocumentNumber, lease.UnitId);
        }

        if (ledger.ReservationId.HasValue && _reservations.FirstOrDefault(r => r.Id == ledger.ReservationId.Value) is { } reservation)
        {
            return (reservation.DocumentNumber, reservation.UnitId);
        }

        return (null, null);
    }
}
