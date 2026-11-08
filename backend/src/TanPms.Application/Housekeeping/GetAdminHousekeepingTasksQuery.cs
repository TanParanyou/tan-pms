namespace TanPms.Application.Housekeeping;

public sealed record GetAdminHousekeepingTasksQuery(
    Guid PropertyId,
    string? Status,
    Guid? BuildingId);
