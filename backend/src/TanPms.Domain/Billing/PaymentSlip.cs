using TanPms.Domain.Common;

namespace TanPms.Domain.Billing;

// Transfer slip submitted by a client against an Invoice; verified by admin (maker-checker).
public sealed class PaymentSlip : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid InvoiceId { get; set; }
    public required Guid CustomerId { get; set; }
    public required decimal Amount { get; set; }
    public string? TransferReference { get; set; }
    public DateTimeOffset? TransferredAt { get; set; }
    public required string SlipFileKey { get; set; }
    public PaymentSlipStatus Status { get; private set; } = PaymentSlipStatus.Pending;
    public string? ReviewedByUserId { get; private set; }
    public DateTimeOffset? ReviewedAt { get; private set; }
    public string? RejectReason { get; private set; }

    public void Approve(string reviewerUserId, DateTimeOffset reviewedAt)
    {
        EnsurePending();
        Status = PaymentSlipStatus.Approved;
        ReviewedByUserId = reviewerUserId;
        ReviewedAt = reviewedAt;
    }

    public void Reject(string reviewerUserId, string reason, DateTimeOffset reviewedAt)
    {
        EnsurePending();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Reject reason is required.",
                httpStatus: 400);
        }

        Status = PaymentSlipStatus.Rejected;
        ReviewedByUserId = reviewerUserId;
        ReviewedAt = reviewedAt;
        RejectReason = reason.Trim();
    }

    public void UpdatePending(decimal amount, string slipFileKey, string? transferReference, DateTimeOffset? transferredAt)
    {
        EnsurePending();
        Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        SlipFileKey = slipFileKey.Trim();
        TransferReference = string.IsNullOrWhiteSpace(transferReference) ? null : transferReference.Trim();
        TransferredAt = transferredAt;
    }

    // Only a Pending slip may be withdrawn (soft-deleted) by its owner; reviewed slips are immutable.
    public void EnsureCanWithdraw() => EnsurePending();

    private void EnsurePending()
    {
        if (Status != PaymentSlipStatus.Pending)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Payment slip is already {Status}.",
                httpStatus: 400);
        }
    }
}
