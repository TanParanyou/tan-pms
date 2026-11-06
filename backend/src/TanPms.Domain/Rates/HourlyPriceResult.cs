namespace TanPms.Domain.Rates;

public sealed record HourlyPriceResult(
    int DurationMinutes,
    int ExtraHours,
    decimal RawCharge,
    decimal FinalHourlyRoomCharge,
    bool IsCappedToDailyRate);
