namespace TanPms.Application.Rates;

public sealed record DailyRateConfigDto(
    decimal WeekdayRate,
    decimal WeekendRate,
    decimal HolidaySurchargeAmount,
    decimal ExtraGuestPrice);
