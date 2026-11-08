namespace TanPms.Application.Housekeeping;

public sealed record CompleteAdminHousekeepingTaskCommand(
    Guid PropertyId,
    Guid TaskId,
    CompleteHousekeepingTaskRequest Request);
