namespace TanPms.Application.Housekeeping;

public sealed record UpdateHousekeepingTaskRequest(
    string? AssignedStaffUserId,
    string? Note);
