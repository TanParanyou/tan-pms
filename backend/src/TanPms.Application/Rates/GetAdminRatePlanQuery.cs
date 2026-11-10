namespace TanPms.Application.Rates;

public sealed record GetAdminRatePlanQuery(
    Guid PropertyId,
    Guid RatePlanId);
