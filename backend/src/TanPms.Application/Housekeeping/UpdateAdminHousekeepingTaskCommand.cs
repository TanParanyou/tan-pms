namespace TanPms.Application.Housekeeping;

public sealed record UpdateAdminHousekeepingTaskCommand(
    Guid PropertyId,
    Guid TaskId,
    UpdateHousekeepingTaskRequest Request);
