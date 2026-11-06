using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Meters;

public sealed class MeterReading : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid UnitId { get; set; }
    public required UtilityType UtilityType { get; set; }
    public required string BillingPeriodYearMonth { get; set; }
    public required decimal PreviousReading { get; set; }
    public required decimal CurrentReading { get; set; }
    public required decimal UsageUnits { get; set; }
    public required decimal ChargeAmount { get; set; }
    public bool IsRolloverConfirmed { get; set; }
    public string? PhotoFileKey { get; set; }
}
