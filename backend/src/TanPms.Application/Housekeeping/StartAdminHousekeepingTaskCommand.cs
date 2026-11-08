namespace TanPms.Application.Housekeeping;

public sealed record StartAdminHousekeepingTaskCommand(
    Guid PropertyId,
    Guid TaskId);
