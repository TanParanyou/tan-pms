namespace TanPms.Application.Properties;

public sealed record UpsertAdminFloorCommand(
    Guid PropertyId,
    UpsertFloorRequest Request);
