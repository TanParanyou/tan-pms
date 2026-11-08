using Microsoft.EntityFrameworkCore;
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
using TanPms.Domain.Rates;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<LeaseListResponse> GetClientLeases(Guid customerId)
    {
        var leases = _dbContext.Leases.AsNoTracking()
            .Where(l => l.CustomerId == customerId)
            .OrderByDescending(l => l.StartDate)
            .ToList();
        return Result<LeaseListResponse>.Success(new LeaseListResponse(leases.Select(l => MapLeaseItemDto(l, unmaskPii: false)).ToList()));
    }

    public Result<LeaseItemDto> GetClientLease(Guid customerId, Guid leaseId)
    {
        var lease = _dbContext.Leases.AsNoTracking().FirstOrDefault(l => l.Id == leaseId && l.CustomerId == customerId);
        return lease is null
            ? Result<LeaseItemDto>.Failure(LeaseRecordMapper.ClientLeaseNotFound())
            : Result<LeaseItemDto>.Success(MapLeaseItemDto(lease, unmaskPii: false));
    }

    public Result<ClientInvoiceListResponse> GetClientInvoices(Guid customerId, string? status)
    {
        if (ClientInvoiceRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<ClientInvoiceListResponse>.Failure(statusError);
        }

        var invoices = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines)
            .Where(i => i.CustomerId == customerId && i.Status != InvoiceStatus.Draft && (statusFilter == null || i.Status == statusFilter))
            .OrderByDescending(i => i.DocumentNumber)
            .ToList();
        return Result<ClientInvoiceListResponse>.Success(new ClientInvoiceListResponse(BuildClientInvoices(invoices)));
    }

    public Result<ClientInvoiceDto> GetClientInvoice(Guid customerId, Guid invoiceId)
    {
        var invoice = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines)
            .FirstOrDefault(i => i.Id == invoiceId && i.CustomerId == customerId);
        return invoice is null || !ClientInvoiceRules.IsVisible(invoice)
            ? Result<ClientInvoiceDto>.Failure(ClientInvoiceRules.NotFound())
            : Result<ClientInvoiceDto>.Success(BuildClientInvoices([invoice])[0]);
    }

    public Result<ClientUtilityUsageResponse> GetClientUtilityUsage(Guid customerId, Guid? leaseId, int months)
    {
        var lease = leaseId.HasValue
            ? _dbContext.Leases.AsNoTracking().FirstOrDefault(l => l.Id == leaseId.Value && l.CustomerId == customerId)
            : _dbContext.Leases.AsNoTracking()
                .Where(l => l.CustomerId == customerId && (l.Status == LeaseStatus.Active || l.Status == LeaseStatus.MoveOutNotice))
                .OrderByDescending(l => l.StartDate)
                .FirstOrDefault();
        if (lease is null)
        {
            return Result<ClientUtilityUsageResponse>.Failure(LeaseRecordMapper.ClientLeaseNotFound());
        }

        var readings = _dbContext.MeterReadings.AsNoTracking().Where(r => r.UnitId == lease.UnitId).ToList();
        return Result<ClientUtilityUsageResponse>.Success(MeterBillingComposer.BuildUtilityUsage(lease, readings, months));
    }

    public Result<ClientPaymentSlipListResponse> GetClientPaymentSlips(Guid customerId)
    {
        var slips = _dbContext.PaymentSlips.AsNoTracking()
            .Where(s => s.CustomerId == customerId)
            .OrderByDescending(s => s.CreatedAt)
            .ToList();
        var invoiceIds = slips.Select(s => s.InvoiceId).Distinct().ToList();
        var invoiceNumbers = _dbContext.Invoices.AsNoTracking()
            .Where(i => invoiceIds.Contains(i.Id))
            .ToDictionary(i => i.Id, i => i.DocumentNumber);
        return Result<ClientPaymentSlipListResponse>.Success(new ClientPaymentSlipListResponse(
            slips.Select(s => CashierRecordMapper.MapClientSlip(s, invoiceNumbers[s.InvoiceId])).ToList()));
    }

    public Result<LeaseIntentDto> CreateClientLeaseIntent(Guid customerId, Guid leaseId, CreateLeaseIntentRequest request, DateTimeOffset? nowUtc = null)
    {
        if (LeaseIntentRules.ParseType(request.IntentType, out var intentType) is { } typeError)
        {
            return Result<LeaseIntentDto>.Failure(typeError);
        }

        var lease = _dbContext.Leases.AsNoTracking().FirstOrDefault(l => l.Id == leaseId);
        if (LeaseIntentRules.CheckLeaseAcceptsIntent(lease, customerId) is { } leaseError)
        {
            return Result<LeaseIntentDto>.Failure(leaseError);
        }

        if (LeaseIntentRules.ValidateDesiredDate(lease!, intentType, request.DesiredDate, AnalyticsPeriod.Today(nowUtc)) is { } dateError)
        {
            return Result<LeaseIntentDto>.Failure(dateError);
        }

        if (_dbContext.LeaseIntentRequests.AsNoTracking().Any(i => i.LeaseId == leaseId && i.Status == LeaseIntentStatus.Pending))
        {
            return Result<LeaseIntentDto>.Failure(LeaseIntentRules.PendingIntentExists(lease!.DocumentNumber));
        }

        var intent = LeaseRecordMapper.BuildIntent(lease!, intentType, request);
        _dbContext.LeaseIntentRequests.Add(intent);
        _dbContext.SaveChanges();
        return Result<LeaseIntentDto>.Success(MapIntents([intent], unmaskPii: false)[0]);
    }

    public Result<LeaseIntentListResponse> GetClientLeaseIntents(Guid customerId) =>
        Result<LeaseIntentListResponse>.Success(new LeaseIntentListResponse(MapIntents(
            _dbContext.LeaseIntentRequests.AsNoTracking().Where(i => i.CustomerId == customerId).OrderByDescending(i => i.CreatedAt).ToList(),
            unmaskPii: false)));

    public Result<LeaseIntentDto> UpdateClientLeaseIntent(Guid customerId, Guid intentId, UpdateLeaseIntentRequest request, DateTimeOffset? nowUtc = null)
    {
        var intent = _dbContext.LeaseIntentRequests.FirstOrDefault(i => i.Id == intentId && i.CustomerId == customerId);
        if (intent is null)
        {
            return Result<LeaseIntentDto>.Failure(LeaseIntentRules.ClientIntentNotFound());
        }

        var lease = _dbContext.Leases.AsNoTracking().First(l => l.Id == intent.LeaseId);
        if (LeaseIntentRules.ValidateDesiredDate(lease, intent.IntentType, request.DesiredDate, AnalyticsPeriod.Today(nowUtc)) is { } dateError)
        {
            return Result<LeaseIntentDto>.Failure(dateError);
        }

        return SaveIntent(intent, i => i.UpdatePending(request.DesiredDate, request.Note));
    }

    public Result<LeaseIntentDto> WithdrawClientLeaseIntent(Guid customerId, Guid intentId)
    {
        var intent = _dbContext.LeaseIntentRequests.FirstOrDefault(i => i.Id == intentId && i.CustomerId == customerId);
        return intent is null
            ? Result<LeaseIntentDto>.Failure(LeaseIntentRules.ClientIntentNotFound())
            : SaveIntent(intent, i => i.Withdraw());
    }

    public Result<LeaseIntentListResponse> GetAdminLeaseIntents(Guid propertyId, string? status, bool unmaskPii = false)
    {
        if (LeaseIntentRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<LeaseIntentListResponse>.Failure(statusError);
        }

        var intents = _dbContext.LeaseIntentRequests.AsNoTracking()
            .Where(i => i.PropertyId == propertyId && (statusFilter == null || i.Status == statusFilter))
            .OrderByDescending(i => i.CreatedAt)
            .ToList();
        return Result<LeaseIntentListResponse>.Success(new LeaseIntentListResponse(MapIntents(intents, unmaskPii)));
    }

    public Result<LeaseIntentDto> ApproveAdminLeaseIntent(Guid propertyId, Guid intentId, string reviewerUserId, DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        using var tx = BeginTransactionIfNeeded();
        var intent = _dbContext.LeaseIntentRequests.FirstOrDefault(i => i.Id == intentId && i.PropertyId == propertyId);
        if (intent is null)
        {
            return Result<LeaseIntentDto>.Failure(LeaseIntentRules.IntentNotFound(propertyId, intentId));
        }

        var lease = _dbContext.Leases.First(l => l.Id == intent.LeaseId);
        try
        {
            intent.Approve(reviewerUserId, clockUtc);
            if (intent.IntentType == LeaseIntentType.Renew)
            {
                // Same PM-06 rules as a manual renewal: Active lease, later end date, extension window must be free.
                LockUnitRow(lease.UnitId);
                var unit = _dbContext.Units.AsNoTracking().First(u => u.Id == lease.UnitId);
                EnsureLeaseWindowAvailable(unit, lease.EndDate.AddDays(1), intent.DesiredDate, clockUtc);
                lease.Renew(intent.DesiredDate, null);
            }
            else
            {
                lease.GiveMoveOutNotice();
            }

            _dbContext.NotificationMessages.Add(LeaseRecordMapper.BuildIntentNotification(intent, lease.DocumentNumber, clockUtc));
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<LeaseIntentDto>.Success(MapIntents([intent], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseIntentDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<LeaseIntentDto> RejectAdminLeaseIntent(Guid propertyId, Guid intentId, string reviewerUserId, ReasonRequest request, DateTimeOffset? nowUtc = null)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<LeaseIntentDto>.Failure(reasonError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        var intent = _dbContext.LeaseIntentRequests.FirstOrDefault(i => i.Id == intentId && i.PropertyId == propertyId);
        if (intent is null)
        {
            return Result<LeaseIntentDto>.Failure(LeaseIntentRules.IntentNotFound(propertyId, intentId));
        }

        var leaseDocumentNumber = _dbContext.Leases.AsNoTracking().Where(l => l.Id == intent.LeaseId).Select(l => l.DocumentNumber).First();
        return SaveIntent(intent, i =>
        {
            i.Reject(reviewerUserId, request.Reason, clockUtc);
            _dbContext.NotificationMessages.Add(LeaseRecordMapper.BuildIntentNotification(i, leaseDocumentNumber, clockUtc));
        });
    }

    private Result<LeaseIntentDto> SaveIntent(LeaseIntentRequest intent, Action<LeaseIntentRequest> mutate)
    {
        try
        {
            mutate(intent);
            _dbContext.SaveChanges();
            return Result<LeaseIntentDto>.Success(MapIntents([intent], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseIntentDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private List<LeaseIntentDto> MapIntents(IReadOnlyList<LeaseIntentRequest> intents, bool unmaskPii)
    {
        var leaseIds = intents.Select(i => i.LeaseId).Distinct().ToList();
        var leases = _dbContext.Leases.AsNoTracking().Where(l => leaseIds.Contains(l.Id)).ToDictionary(l => l.Id);
        var unitIds = leases.Values.Select(l => l.UnitId).Distinct().ToList();
        var unitRefs = _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToList().ToDictionary(u => u.Id, BuildSingleUnitRef);
        var customerIds = intents.Select(i => i.CustomerId).Distinct().ToList();
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);
        var users = UserRefs();
        return intents.Select(i => LeaseRecordMapper.MapIntent(
            i, leases[i.LeaseId], unitRefs[leases[i.LeaseId].UnitId], customers[i.CustomerId], users, unmaskPii)).ToList();
    }

    private List<ClientInvoiceDto> BuildClientInvoices(IReadOnlyList<Invoice> invoices)
    {
        var invoiceIds = invoices.Select(i => i.Id).ToList();
        var invoiceDtos = invoices.GroupBy(i => i.PropertyId).SelectMany(g => MapInvoices(g.Key, g.ToList(), unmaskPii: false)).ToDictionary(i => i.Id);
        var receipts = _dbContext.Receipts.AsNoTracking().Where(r => invoiceIds.Contains(r.InvoiceId)).OrderBy(r => r.CreatedAt).ToList();
        var receiptDtos = MapReceipts(receipts, unmaskPii: false);
        var slips = _dbContext.PaymentSlips.AsNoTracking().Where(s => invoiceIds.Contains(s.InvoiceId)).OrderByDescending(s => s.CreatedAt).ToList();
        return invoices.Select(invoice =>
        {
            var invoiceReceipts = receipts.Where(r => r.InvoiceId == invoice.Id).ToList();
            return new ClientInvoiceDto(
                invoiceDtos[invoice.Id],
                invoiceReceipts.Sum(r => r.NetPayableAmount),
                PaymentSlipRules.Outstanding(invoice, invoiceReceipts),
                receiptDtos.Where(r => r.InvoiceId == invoice.Id).ToList(),
                slips.Where(s => s.InvoiceId == invoice.Id).Select(s => CashierRecordMapper.MapClientSlip(s, invoice.DocumentNumber)).ToList());
        }).ToList();
    }
}
