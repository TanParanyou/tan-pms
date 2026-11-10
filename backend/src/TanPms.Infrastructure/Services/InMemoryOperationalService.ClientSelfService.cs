using TanPms.Application.Common.Models;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Payments;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.Leases;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<LeaseIntentRequest> _leaseIntents = [];

    public Result<LeaseListResponse> GetClientLeases(Guid customerId)
    {
        lock (_syncRoot)
        {
            return Result<LeaseListResponse>.Success(new LeaseListResponse(_leases
                .Where(l => l.CustomerId == customerId)
                .OrderByDescending(l => l.StartDate)
                .Select(l => MapLeaseItemLocked(l, unmaskPii: false))
                .ToList()));
        }
    }

    public Result<LeaseItemDto> GetClientLease(Guid customerId, Guid leaseId)
    {
        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.CustomerId == customerId);
            return lease is null
                ? Result<LeaseItemDto>.Failure(LeaseRecordMapper.ClientLeaseNotFound())
                : Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease, unmaskPii: false));
        }
    }

    public Result<ClientInvoiceListResponse> GetClientInvoices(Guid customerId, string? status, PageRequest? paging = null)
    {
        if (ClientInvoiceRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<ClientInvoiceListResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            var (page, pagination) = _invoices
                .Where(i => i.CustomerId == customerId && ClientInvoiceRules.IsVisible(i) && (statusFilter == null || i.Status == statusFilter))
                .OrderByDescending(i => i.DocumentNumber, StringComparer.Ordinal)
                .AsQueryable()
                .ToPage(paging);
            return Result<ClientInvoiceListResponse>.Success(new ClientInvoiceListResponse(page.Select(BuildClientInvoiceLocked).ToList(), pagination));
        }
    }

    public Result<ClientInvoiceDto> GetClientInvoice(Guid customerId, Guid invoiceId)
    {
        lock (_syncRoot)
        {
            var invoice = _invoices.FirstOrDefault(i => i.Id == invoiceId && i.CustomerId == customerId);
            return invoice is null || !ClientInvoiceRules.IsVisible(invoice)
                ? Result<ClientInvoiceDto>.Failure(ClientInvoiceRules.NotFound())
                : Result<ClientInvoiceDto>.Success(BuildClientInvoiceLocked(invoice));
        }
    }

    public Result<ClientUtilityUsageResponse> GetClientUtilityUsage(Guid customerId, Guid? leaseId, int months)
    {
        lock (_syncRoot)
        {
            var lease = leaseId.HasValue
                ? _leases.FirstOrDefault(l => l.Id == leaseId.Value && l.CustomerId == customerId)
                : _leases.Where(l => l.CustomerId == customerId && l.BlocksUnitAvailability).OrderByDescending(l => l.StartDate).FirstOrDefault();
            return lease is null
                ? Result<ClientUtilityUsageResponse>.Failure(LeaseRecordMapper.ClientLeaseNotFound())
                : Result<ClientUtilityUsageResponse>.Success(MeterBillingComposer.BuildUtilityUsage(
                    lease, _meterReadings.Where(r => r.UnitId == lease.UnitId).ToList(), months));
        }
    }

    public Result<ClientPaymentSlipListResponse> GetClientPaymentSlips(Guid customerId, PageRequest? paging = null)
    {
        lock (_syncRoot)
        {
            var (page, pagination) = _paymentSlips
                .Where(s => s.CustomerId == customerId)
                .OrderByDescending(s => s.CreatedAt)
                .ThenByDescending(s => s.Id)
                .AsQueryable()
                .ToPage(paging);
            return Result<ClientPaymentSlipListResponse>.Success(new ClientPaymentSlipListResponse(
                page.Select(s => CashierRecordMapper.MapClientSlip(s, _invoices.First(i => i.Id == s.InvoiceId).DocumentNumber)).ToList(),
                pagination));
        }
    }

    public Result<LeaseIntentDto> CreateClientLeaseIntent(Guid customerId, Guid leaseId, CreateLeaseIntentRequest request, DateTimeOffset? nowUtc = null)
    {
        if (LeaseIntentRules.ParseType(request.IntentType, out var intentType) is { } typeError)
        {
            return Result<LeaseIntentDto>.Failure(typeError);
        }

        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId);
            if (LeaseIntentRules.CheckLeaseAcceptsIntent(lease, customerId) is { } leaseError)
            {
                return Result<LeaseIntentDto>.Failure(leaseError);
            }

            if (LeaseIntentRules.ValidateDesiredDate(lease!, intentType, request.DesiredDate, AnalyticsPeriod.Today(nowUtc)) is { } dateError)
            {
                return Result<LeaseIntentDto>.Failure(dateError);
            }

            if (_leaseIntents.Any(i => i.LeaseId == leaseId && i.Status == LeaseIntentStatus.Pending))
            {
                return Result<LeaseIntentDto>.Failure(LeaseIntentRules.PendingIntentExists(lease!.DocumentNumber));
            }

            var intent = LeaseRecordMapper.BuildIntent(lease!, intentType, request);
            _leaseIntents.Add(intent);
            return Result<LeaseIntentDto>.Success(MapIntentLocked(intent, unmaskPii: false));
        }
    }

    public Result<LeaseIntentListResponse> GetClientLeaseIntents(Guid customerId)
    {
        lock (_syncRoot)
        {
            return Result<LeaseIntentListResponse>.Success(new LeaseIntentListResponse(_leaseIntents
                .Where(i => i.CustomerId == customerId)
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => MapIntentLocked(i, unmaskPii: false))
                .ToList()));
        }
    }

    public Result<LeaseIntentDto> UpdateClientLeaseIntent(Guid customerId, Guid intentId, UpdateLeaseIntentRequest request, DateTimeOffset? nowUtc = null)
    {
        lock (_syncRoot)
        {
            var intent = _leaseIntents.FirstOrDefault(i => i.Id == intentId && i.CustomerId == customerId);
            if (intent is null)
            {
                return Result<LeaseIntentDto>.Failure(LeaseIntentRules.ClientIntentNotFound());
            }

            var lease = _leases.First(l => l.Id == intent.LeaseId);
            return LeaseIntentRules.ValidateDesiredDate(lease, intent.IntentType, request.DesiredDate, AnalyticsPeriod.Today(nowUtc)) is { } dateError
                ? Result<LeaseIntentDto>.Failure(dateError)
                : MutateIntentLocked(intent, i => i.UpdatePending(request.DesiredDate, request.Note));
        }
    }

    public Result<LeaseIntentDto> WithdrawClientLeaseIntent(Guid customerId, Guid intentId)
    {
        lock (_syncRoot)
        {
            var intent = _leaseIntents.FirstOrDefault(i => i.Id == intentId && i.CustomerId == customerId);
            return intent is null
                ? Result<LeaseIntentDto>.Failure(LeaseIntentRules.ClientIntentNotFound())
                : MutateIntentLocked(intent, i => i.Withdraw());
        }
    }

    public Result<LeaseIntentListResponse> GetAdminLeaseIntents(Guid propertyId, string? status, bool unmaskPii = false, PageRequest? paging = null)
    {
        if (LeaseIntentRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<LeaseIntentListResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            var (page, pagination) = _leaseIntents
                .Where(i => i.PropertyId == propertyId && (statusFilter == null || i.Status == statusFilter))
                .OrderByDescending(i => i.CreatedAt)
                .ThenByDescending(i => i.Id)
                .AsQueryable()
                .ToPage(paging);
            return Result<LeaseIntentListResponse>.Success(new LeaseIntentListResponse(page.Select(i => MapIntentLocked(i, unmaskPii)).ToList(), pagination));
        }
    }

    public Result<LeaseIntentDto> ApproveAdminLeaseIntent(Guid propertyId, Guid intentId, string reviewerUserId, DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            var intent = _leaseIntents.FirstOrDefault(i => i.Id == intentId && i.PropertyId == propertyId);
            if (intent is null)
            {
                return Result<LeaseIntentDto>.Failure(LeaseIntentRules.IntentNotFound(propertyId, intentId));
            }

            var lease = _leases.First(l => l.Id == intent.LeaseId);
            try
            {
                // Validate everything before mutating, because the in-memory store has no transaction to roll back.
                intent.EnsurePending();
                if (intent.IntentType == LeaseIntentType.Renew)
                {
                    EnsureLeaseWindowAvailableLocked(_units[lease.UnitId], lease.EndDate.AddDays(1), intent.DesiredDate, clockUtc);
                    lease.Renew(intent.DesiredDate, null);
                    Touch(lease, clockUtc);
                }
                else
                {
                    lease.GiveMoveOutNotice();
                    Touch(lease, clockUtc);
                }

                intent.Approve(reviewerUserId, clockUtc);
                Touch(intent, clockUtc);
                _notifications.Add(LeaseRecordMapper.BuildIntentNotification(intent, lease.DocumentNumber, clockUtc));
                return Result<LeaseIntentDto>.Success(MapIntentLocked(intent, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<LeaseIntentDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<LeaseIntentDto> RejectAdminLeaseIntent(Guid propertyId, Guid intentId, string reviewerUserId, ReasonRequest request, DateTimeOffset? nowUtc = null)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<LeaseIntentDto>.Failure(reasonError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            var intent = _leaseIntents.FirstOrDefault(i => i.Id == intentId && i.PropertyId == propertyId);
            if (intent is null)
            {
                return Result<LeaseIntentDto>.Failure(LeaseIntentRules.IntentNotFound(propertyId, intentId));
            }

            var leaseDocumentNumber = _leases.First(l => l.Id == intent.LeaseId).DocumentNumber;
            return MutateIntentLocked(intent, i =>
            {
                i.Reject(reviewerUserId, request.Reason, clockUtc);
                _notifications.Add(LeaseRecordMapper.BuildIntentNotification(i, leaseDocumentNumber, clockUtc));
            });
        }
    }

    private Result<LeaseIntentDto> MutateIntentLocked(LeaseIntentRequest intent, Action<LeaseIntentRequest> mutate)
    {
        try
        {
            mutate(intent);
            Touch(intent);
            return Result<LeaseIntentDto>.Success(MapIntentLocked(intent, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseIntentDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private LeaseIntentDto MapIntentLocked(LeaseIntentRequest intent, bool unmaskPii)
    {
        var lease = _leases.First(l => l.Id == intent.LeaseId);
        return LeaseRecordMapper.MapIntent(intent, lease, _unitRefs[lease.UnitId], _customers[intent.CustomerId], UserRefsLocked(), unmaskPii);
    }

    private ClientInvoiceDto BuildClientInvoiceLocked(Invoice invoice)
    {
        var receipts = _receipts.Where(r => r.InvoiceId == invoice.Id).OrderBy(r => r.CreatedAt).ToList();
        return new ClientInvoiceDto(
            MapInvoiceLocked(invoice, unmaskPii: false),
            receipts.Sum(r => r.NetPayableAmount),
            PaymentSlipRules.Outstanding(invoice, receipts),
            receipts.Select(r => MapReceiptLocked(r, unmaskPii: false)).ToList(),
            _paymentSlips
                .Where(s => s.InvoiceId == invoice.Id)
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => CashierRecordMapper.MapClientSlip(s, invoice.DocumentNumber))
                .ToList());
    }
}
