namespace TanPms.Application.Rates;

public sealed record UpsertAdminUtilityTariffCommand(
    Guid PropertyId,
    UpsertUtilityTariffRequest Request);
