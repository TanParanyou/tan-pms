namespace TanPms.Application.Properties;

public sealed record DeleteAdminUnitCommand(
    Guid PropertyId,
    Guid UnitId);
