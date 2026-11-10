namespace TanPms.Application.Properties;

public sealed record UpsertAdminUnitTypeCommand(
    Guid PropertyId,
    UpsertUnitTypeRequest Request);
