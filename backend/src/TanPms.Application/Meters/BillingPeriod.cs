using System.Globalization;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Meters;

// Billing periods are calendar months formatted "YYYY-MM" (matches MeterReading.BillingPeriodYearMonth).
public static class BillingPeriod
{
    public static Error? Parse(string? period, out DateOnly startDate, out DateOnly endDate)
    {
        startDate = default;
        endDate = default;
        if (string.IsNullOrWhiteSpace(period)
            || !DateOnly.TryParseExact(period.Trim() + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out startDate))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Period '{period}' must be formatted as YYYY-MM.");
        }

        endDate = startDate.AddMonths(1).AddDays(-1);
        return null;
    }

    public static string Format(DateOnly startDate) =>
        startDate.ToString("yyyy-MM", CultureInfo.InvariantCulture);
}
