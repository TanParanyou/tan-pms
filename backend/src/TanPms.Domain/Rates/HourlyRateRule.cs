using TanPms.Domain.Common;

namespace TanPms.Domain.Rates;

public sealed record HourlyRateRule(
    int BasePackageHours,
    decimal BasePackagePrice,
    decimal AdditionalHourPrice,
    int GracePeriodMinutes,
    decimal AutoCapToDailyRate,
    int TurnaroundBufferMinutes = 30,
    LocalizedText? Name = null);
