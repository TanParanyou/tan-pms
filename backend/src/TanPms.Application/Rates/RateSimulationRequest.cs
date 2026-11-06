namespace TanPms.Application.Rates;

public sealed record RateSimulationRequest(
    Guid RatePlanId,
    int DurationMinutes,
    decimal WaterPreviousReading,
    decimal WaterCurrentReading,
    bool WaterRolloverConfirmed,
    decimal ElectricPreviousReading,
    decimal ElectricCurrentReading,
    bool ElectricRolloverConfirmed,
    int OccupantCount,
    Guid TaxProfileId,
    decimal SampleLineAmount,
    bool ApplyWithholdingTax);
