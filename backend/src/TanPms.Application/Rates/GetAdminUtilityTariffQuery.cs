namespace TanPms.Application.Rates;

public sealed record GetAdminUtilityTariffQuery(
    Guid PropertyId,
    Guid TariffId);
