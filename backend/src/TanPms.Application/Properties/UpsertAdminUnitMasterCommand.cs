namespace TanPms.Application.Properties;

public sealed record UpsertAdminUnitMasterCommand(
    Guid PropertyId,
    UpsertUnitMasterRequest Request);
