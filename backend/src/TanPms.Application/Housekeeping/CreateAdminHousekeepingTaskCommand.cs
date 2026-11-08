namespace TanPms.Application.Housekeeping;

public sealed record CreateAdminHousekeepingTaskCommand(
    Guid PropertyId,
    CreateHousekeepingTaskRequest Request);
