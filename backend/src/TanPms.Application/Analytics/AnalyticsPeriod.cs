using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Analytics;

// Report dates are property-local (Asia/Bangkok, UTC+7 all year) so a "day" matches the front desk's day.
public static class AnalyticsPeriod
{
    public const int DefaultDays = 30;
    public const int MaxDays = 366;
    public static readonly TimeSpan BangkokOffset = TimeSpan.FromHours(7);

    public static DateOnly LocalDate(DateTimeOffset instant) =>
        DateOnly.FromDateTime(instant.ToOffset(BangkokOffset).DateTime);

    public static DateOnly Today(DateTimeOffset? nowUtc = null) => LocalDate(nowUtc ?? DateTimeOffset.UtcNow);

    // Defaults to the last 30 days ending today (inclusive).
    public static Error? Resolve(DateOnly? from, DateOnly? to, DateOnly today, out DateOnly resolvedFrom, out DateOnly resolvedTo)
    {
        resolvedTo = to ?? today;
        resolvedFrom = from ?? resolvedTo.AddDays(-(DefaultDays - 1));
        if (resolvedFrom > resolvedTo)
        {
            return new Error(DomainErrorCodes.ValidationFailed, "'from' must not be after 'to'.");
        }

        return resolvedTo.DayNumber - resolvedFrom.DayNumber + 1 > MaxDays
            ? new Error(DomainErrorCodes.ValidationFailed, $"Report range cannot exceed {MaxDays} days.")
            : null;
    }
}
