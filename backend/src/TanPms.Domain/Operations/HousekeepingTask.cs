using TanPms.Domain.Common;
using TanPms.Domain.Properties;

namespace TanPms.Domain.Operations;

public sealed class HousekeepingTask : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid UnitId { get; set; }
    public required string SourceDocumentNumber { get; set; }
    public string? AssignedStaffUserId { get; set; }
    public HousekeepingTaskStatus Status { get; set; } = HousekeepingTaskStatus.Pending;

    public void AdvanceUnitCondition(Unit unit)
    {
        switch (Status)
        {
            case HousekeepingTaskStatus.Pending:
                Status = HousekeepingTaskStatus.Cleaning;
                unit.SetConditionStatus(ConditionStatus.Cleaning);
                break;
            case HousekeepingTaskStatus.Cleaning:
                Status = HousekeepingTaskStatus.Inspecting;
                unit.SetConditionStatus(ConditionStatus.Inspecting);
                break;
            case HousekeepingTaskStatus.Inspecting:
                Status = HousekeepingTaskStatus.Completed;
                unit.SetConditionStatus(ConditionStatus.Clean);
                break;
        }
    }

    public void Assign(string staffUserId)
    {
        if (Status == HousekeepingTaskStatus.Completed || string.IsNullOrWhiteSpace(staffUserId))
        {
            throw Invalid("Only an unfinished HousekeepingTask can be assigned to a staff user.");
        }

        AssignedStaffUserId = staffUserId.Trim();
    }

    public void Start(Unit unit)
    {
        if (Status != HousekeepingTaskStatus.Pending)
        {
            throw Invalid($"HousekeepingTask in status {Status} cannot start cleaning.");
        }

        AdvanceUnitCondition(unit);
    }

    // Cleaning -> Inspecting (or straight to Completed/Clean when inspection is skipped); Inspecting -> Completed/Clean.
    public void Complete(Unit unit, bool skipInspection)
    {
        switch (Status)
        {
            case HousekeepingTaskStatus.Cleaning:
                AdvanceUnitCondition(unit);
                if (skipInspection)
                {
                    AdvanceUnitCondition(unit);
                }

                break;
            case HousekeepingTaskStatus.Inspecting:
                AdvanceUnitCondition(unit);
                break;
            default:
                throw Invalid($"HousekeepingTask in status {Status} cannot be completed.");
        }
    }

    private static DomainRuleException Invalid(string message) =>
        new(DomainErrorCodes.ValidationFailed, message, httpStatus: 400);
}
