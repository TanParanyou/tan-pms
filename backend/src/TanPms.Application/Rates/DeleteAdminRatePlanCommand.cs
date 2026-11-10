namespace TanPms.Application.Rates;

public sealed record DeleteAdminRatePlanCommand(
    Guid PropertyId,
    Guid RatePlanId);
