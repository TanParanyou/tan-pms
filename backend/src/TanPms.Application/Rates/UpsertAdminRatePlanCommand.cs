namespace TanPms.Application.Rates;

public sealed record UpsertAdminRatePlanCommand(
    Guid PropertyId,
    UpsertRatePlanRequest Request);
