using TanPms.Domain.Common;

namespace TanPms.Domain.Leases;

// Tenant-submitted intent to renew or move out ("แจ้งความประสงค์ต่อสัญญา/ย้ายออก"), reviewed by admin.
public sealed class LeaseIntentRequest : AuditableEntity
{
    public required Guid PropertyId { get; init; }
    public required Guid LeaseId { get; init; }
    public required Guid CustomerId { get; init; }
    public required LeaseIntentType IntentType { get; init; }
    public required DateOnly DesiredDate { get; set; }
    public string? Note { get; set; }
    public LeaseIntentStatus Status { get; private set; } = LeaseIntentStatus.Pending;
    public string? ReviewedByUserId { get; private set; }
    public DateTimeOffset? ReviewedAt { get; private set; }
    public string? RejectReason { get; private set; }

    public void UpdatePending(DateOnly desiredDate, string? note)
    {
        EnsurePending();
        DesiredDate = desiredDate;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    public void Withdraw()
    {
        EnsurePending();
        Status = LeaseIntentStatus.Withdrawn;
    }

    public void Approve(string reviewerUserId, DateTimeOffset reviewedAt)
    {
        EnsurePending();
        Status = LeaseIntentStatus.Approved;
        ReviewedByUserId = reviewerUserId;
        ReviewedAt = reviewedAt;
    }

    public void Reject(string reviewerUserId, string reason, DateTimeOffset reviewedAt)
    {
        EnsurePending();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Reject reason is required.", httpStatus: 400);
        }

        Status = LeaseIntentStatus.Rejected;
        ReviewedByUserId = reviewerUserId;
        ReviewedAt = reviewedAt;
        RejectReason = reason.Trim();
    }

    public void EnsurePending()
    {
        if (Status != LeaseIntentStatus.Pending)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Lease intent is already {Status}.",
                httpStatus: 400);
        }
    }
}
