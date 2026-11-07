using TanPms.Domain.Common;

namespace TanPms.Application.Meters;

// Per-row issue codes returned inside SaveMeterReadingsResponse (not Problem Details codes).
public static class MeterReadingIssueCodes
{
    public const string RolloverUnconfirmed = DomainErrorCodes.MeterRolloverUnconfirmed;
    public const string NegativeReading = "meter.negative_reading";
    public const string NoActiveLease = "meter.no_active_lease";
    public const string DuplicateUnit = "meter.duplicate_unit";
    public const string TariffMissing = "meter.tariff_missing";
    public const string PeriodLocked = "meter.period_locked";
    public const string OverrideReasonRequired = "meter.override_reason_required";
    public const string UsageAnomaly = "meter.usage_anomaly";
}
