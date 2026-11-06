namespace TanPms.Application.Rates;

public sealed record RateSimulationResponse(
    HourlySimulationQuoteDto HourlyQuote,
    UtilitySimulationQuoteDto WaterQuote,
    UtilitySimulationQuoteDto ElectricQuote,
    TaxSimulationQuoteDto TaxQuote);
