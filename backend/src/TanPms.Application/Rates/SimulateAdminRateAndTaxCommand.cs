namespace TanPms.Application.Rates;

public sealed record SimulateAdminRateAndTaxCommand(
    Guid PropertyId,
    RateSimulationRequest Request);
