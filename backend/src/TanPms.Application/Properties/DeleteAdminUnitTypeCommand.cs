namespace TanPms.Application.Properties;

public sealed record DeleteAdminUnitTypeCommand(
    Guid PropertyId,
    Guid UnitTypeId);
