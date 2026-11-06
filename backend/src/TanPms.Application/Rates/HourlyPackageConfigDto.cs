namespace TanPms.Application.Rates;

public sealed record HourlyPackageConfigDto(
    int BasePackageHours,
    decimal BasePackagePrice,
    decimal AdditionalHourPrice,
    int GracePeriodMinutes,
    decimal AutoCapToDailyRate,
    int TurnaroundBufferMinutes);
