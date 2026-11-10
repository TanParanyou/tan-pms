namespace TanPms.Application.Housekeeping;

public sealed record GetAdminHousekeepingTasksQuery(
    Guid PropertyId,
    string? Status,
    Guid? BuildingId,
    int? Page = null,
    int? PageSize = null);
