using TanPms.Domain.Common;
using TanPms.Domain.Operations;

namespace TanPms.Domain.Properties;

public sealed class Unit : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid BuildingId { get; set; }
    public required Guid FloorId { get; set; }
    public required Guid UnitTypeId { get; set; }
    public required string UnitNumber { get; set; }
    public OccupancyStatus OccupancyStatus { get; private set; } = OccupancyStatus.Vacant;
    public ConditionStatus ConditionStatus { get; private set; } = ConditionStatus.Clean;
    public List<StayMode> SupportedStayModes { get; init; } = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly];

    public void EnsureCanCheckIn(bool overrideDirtyCheckIn, bool hasOverridePermission, string? overrideReason)
    {
        if (ConditionStatus == ConditionStatus.Clean)
        {
            return;
        }

        if (!overrideDirtyCheckIn)
        {
            throw new DomainRuleException(
                DomainErrorCodes.UnitNotClean,
                $"Unit {UnitNumber} is currently in {ConditionStatus} status and cannot be checked in without override permission.");
        }

        if (!hasOverridePermission)
        {
            throw new DomainRuleException(
                DomainErrorCodes.PermissionDenied,
                "Caller does not hold permission 'admin.stay.override_dirty_checkin'.",
                httpStatus: 403);
        }

        if (string.IsNullOrWhiteSpace(overrideReason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "An audit reason is required when overriding a dirty unit check-in.",
                httpStatus: 400);
        }
    }

    public void MarkOccupied()
    {
        if (OccupancyStatus == OccupancyStatus.Blocked)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Unit {UnitNumber} is blocked and cannot be occupied.");
        }

        OccupancyStatus = OccupancyStatus.Occupied;
    }

    public void MarkReserved()
    {
        OccupancyStatus = OccupancyStatus.Reserved;
    }

    public void MarkBlocked()
    {
        OccupancyStatus = OccupancyStatus.Blocked;
        ConditionStatus = ConditionStatus.OutOfOrder;
    }

    public HousekeepingTask MarkCheckedOutOrMovedOut(string documentNumber)
    {
        OccupancyStatus = OccupancyStatus.Vacant;
        ConditionStatus = ConditionStatus.Dirty;
        return new HousekeepingTask
        {
            PropertyId = PropertyId,
            UnitId = Id,
            SourceDocumentNumber = documentNumber,
            Status = HousekeepingTaskStatus.Pending
        };
    }

    public void SetConditionStatus(ConditionStatus nextStatus)
    {
        ConditionStatus = nextStatus;
    }
}
