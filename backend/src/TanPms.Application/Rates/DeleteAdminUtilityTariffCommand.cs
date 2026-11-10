namespace TanPms.Application.Rates;

public sealed record DeleteAdminUtilityTariffCommand(
    Guid PropertyId,
    Guid TariffId);
