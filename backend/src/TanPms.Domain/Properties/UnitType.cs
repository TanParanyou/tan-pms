using TanPms.Domain.Common;

namespace TanPms.Domain.Properties;

public sealed class UnitType : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string Code { get; set; }
    public required LocalizedText Name { get; set; }
    public LocalizedText? Description { get; set; }
    public decimal AreaSqm { get; set; }
    public int TotalQuotaUnits { get; set; }
    public List<StayMode> SupportedStayModes { get; init; } = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly];
    public decimal HourlyBasePackagePrice { get; set; }
    public int HourlyBasePackageHours { get; set; } = 3;
    public decimal HourlyAdditionalHourPrice { get; set; }
    public int HourlyGracePeriodMinutes { get; set; } = 15;
    public int TurnaroundBufferMinutes { get; set; } = 30;
    public decimal DailyRate { get; set; }
    public decimal MonthlyRentRate { get; set; }
}
