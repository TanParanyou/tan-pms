using TanPms.Domain.Common;

namespace TanPms.Domain.Operations;

public sealed class WorkOrder : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public Guid? ReportedByCustomerId { get; set; }
    public required string IssueSummary { get; set; }
    public string? BeforePhotoFileKey { get; set; }
    public string? AfterPhotoFileKey { get; set; }
    public decimal TenantChargeAmount { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Open;
    public string? Description { get; set; }
    public WorkOrderPriority Priority { get; set; } = WorkOrderPriority.Normal;
    public string? AssignedTechnicianUserId { get; private set; }
    public string? ResolutionNotes { get; private set; }
    public string? ChargeDocumentNumber { get; private set; }
    public string? CancelReason { get; private set; }

    public bool HasPostedCharge => ChargeDocumentNumber is not null || TenantChargeAmount > 0m;

    public void UpdateDetails(string issueSummary, string? description, WorkOrderPriority priority, string? beforePhotoFileKey)
    {
        if (Status != WorkOrderStatus.Open)
        {
            throw Invalid($"WorkOrder {DocumentNumber} can only be edited while Open (current: {Status}).");
        }

        if (string.IsNullOrWhiteSpace(issueSummary))
        {
            throw Invalid("IssueSummary is required.");
        }

        IssueSummary = issueSummary.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Priority = priority;
        BeforePhotoFileKey = string.IsNullOrWhiteSpace(beforePhotoFileKey) ? BeforePhotoFileKey : beforePhotoFileKey.Trim();
    }

    // Open/InProgress (or Completed without a posted tenant charge) -> Cancelled.
    public void Cancel(string reason)
    {
        if (Status == WorkOrderStatus.Cancelled || (Status == WorkOrderStatus.Completed && HasPostedCharge))
        {
            throw Invalid($"WorkOrder {DocumentNumber} in status {Status} cannot be cancelled.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw Invalid("Cancel reason is required.");
        }

        CancelReason = reason.Trim();
        Status = WorkOrderStatus.Cancelled;
    }

    // Open/InProgress -> InProgress (re-assignment allowed until resolved).
    public void Assign(string technicianUserId)
    {
        if (Status is not (WorkOrderStatus.Open or WorkOrderStatus.InProgress))
        {
            throw Invalid($"WorkOrder {DocumentNumber} in status {Status} cannot be assigned.");
        }

        if (string.IsNullOrWhiteSpace(technicianUserId))
        {
            throw Invalid("TechnicianUserId is required.");
        }

        AssignedTechnicianUserId = technicianUserId.Trim();
        Status = WorkOrderStatus.InProgress;
    }

    // InProgress -> Completed; the tenant charge (if any) is posted by the caller to a Folio or Draft Invoice.
    public void Resolve(string resolutionNotes, string? afterPhotoFileKey, decimal tenantChargeAmount, string? chargeDocumentNumber)
    {
        EnsureCanResolve(resolutionNotes, tenantChargeAmount);
        ResolutionNotes = resolutionNotes.Trim();
        AfterPhotoFileKey = string.IsNullOrWhiteSpace(afterPhotoFileKey) ? AfterPhotoFileKey : afterPhotoFileKey.Trim();
        TenantChargeAmount = decimal.Round(tenantChargeAmount, 2, MidpointRounding.AwayFromZero);
        ChargeDocumentNumber = chargeDocumentNumber;
        Status = WorkOrderStatus.Completed;
    }

    // Lets callers validate before posting a tenant charge to a Folio or Invoice.
    public void EnsureCanResolve(string resolutionNotes, decimal tenantChargeAmount)
    {
        if (Status != WorkOrderStatus.InProgress)
        {
            throw Invalid($"WorkOrder {DocumentNumber} must be InProgress to resolve (current: {Status}).");
        }

        if (string.IsNullOrWhiteSpace(resolutionNotes))
        {
            throw Invalid("ResolutionNotes is required.");
        }

        if (tenantChargeAmount < 0m)
        {
            throw Invalid("Repair cost cannot be negative.");
        }
    }

    private static DomainRuleException Invalid(string message) =>
        new(DomainErrorCodes.ValidationFailed, message, httpStatus: 400);
}
