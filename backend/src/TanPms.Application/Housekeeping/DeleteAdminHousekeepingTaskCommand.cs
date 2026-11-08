namespace TanPms.Application.Housekeeping;

public sealed record DeleteAdminHousekeepingTaskCommand(
    Guid PropertyId,
    Guid TaskId);
