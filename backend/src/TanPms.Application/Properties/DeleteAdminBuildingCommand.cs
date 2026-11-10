namespace TanPms.Application.Properties;

public sealed record DeleteAdminBuildingCommand(
    Guid PropertyId,
    Guid BuildingId);
