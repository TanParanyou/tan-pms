namespace TanPms.Application.Housekeeping;

public sealed record AssignAdminHousekeepingTaskCommand(
    Guid PropertyId,
    Guid TaskId,
    AssignHousekeepingTaskRequest Request);
