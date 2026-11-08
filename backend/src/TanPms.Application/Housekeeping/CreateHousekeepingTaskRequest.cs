namespace TanPms.Application.Housekeeping;

public sealed record CreateHousekeepingTaskRequest(
    Guid UnitId,
    string? Note = null,
    string? AssignedStaffUserId = null);
