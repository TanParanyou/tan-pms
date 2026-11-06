namespace TanPms.Application.Rates;

public sealed record HourlySimulationQuoteDto(
    int DurationMinutes,
    int ExtraHours,
    decimal RawCharge,
    decimal FinalHourlyRoomCharge,
    bool IsCappedToDailyRate,
    int TurnaroundBufferMinutes);
