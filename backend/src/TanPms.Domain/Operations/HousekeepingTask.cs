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
}
