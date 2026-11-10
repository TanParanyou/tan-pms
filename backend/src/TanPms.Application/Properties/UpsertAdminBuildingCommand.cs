namespace TanPms.Application.Properties;

public sealed record UpsertAdminBuildingCommand(
    Guid PropertyId,
    UpsertBuildingRequest Request);
