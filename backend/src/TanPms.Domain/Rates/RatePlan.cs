using TanPms.Domain.Common;
using TanPms.Domain.Properties;

namespace TanPms.Domain.Rates;

public sealed class RatePlan : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid UnitTypeId { get; set; }
    public required string Code { get; set; }
    public required LocalizedText Name { get; set; }
    public List<StayMode> SupportedStayModes { get; private set; } = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly];

    public int BasePackageHours { get; private set; } = 3;
    public decimal BasePackagePrice { get; private set; }
    public decimal AdditionalHourPrice { get; private set; }
    public int GracePeriodMinutes { get; private set; } = 15;
    public decimal AutoCapToDailyRate { get; private set; }
    public int TurnaroundBufferMinutes { get; private set; } = 30;

    public decimal WeekdayRate { get; private set; }
    public decimal WeekendRate { get; private set; }
    public decimal HolidaySurchargeAmount { get; private set; }
    public decimal ExtraGuestPrice { get; private set; }

    public decimal MonthlyRentRate { get; private set; }
    public int MinimumLeaseMonths { get; private set; } = 6;
    public int SecurityDepositMonths { get; private set; } = 2;

    public bool IsActive { get; private set; } = true;

    public void UpdateConfiguration(
        string code,
        LocalizedText name,
        Guid unitTypeId,
        IEnumerable<StayMode> supportedStayModes,
        int basePackageHours,
        decimal basePackagePrice,
        decimal additionalHourPrice,
        int gracePeriodMinutes,
        decimal autoCapToDailyRate,
        int turnaroundBufferMinutes,
        decimal weekdayRate,
        decimal weekendRate,
        decimal holidaySurchargeAmount,
        decimal extraGuestPrice,
        decimal monthlyRentRate,
        int minimumLeaseMonths,
        int securityDepositMonths,
        bool isActive)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "RatePlan Code cannot be empty.",
                httpStatus: 400);
        }

        var modes = supportedStayModes.Distinct().ToList();
        if (modes.Count == 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "RatePlan must support at least one StayMode.",
                httpStatus: 400);
        }

        if (basePackageHours < 1 || gracePeriodMinutes < 0 || turnaroundBufferMinutes < 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Hourly package hours must be >= 1 and grace/buffer minutes cannot be negative.",
                httpStatus: 400);
        }

        if (basePackagePrice < 0m || additionalHourPrice < 0m || autoCapToDailyRate < basePackagePrice)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Hourly prices must be non-negative and AutoCapToDailyRate must be >= BasePackagePrice.",
                httpStatus: 400);
        }

        if (weekdayRate < 0m || weekendRate < 0m || holidaySurchargeAmount < 0m || extraGuestPrice < 0m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Daily rate parameters cannot be negative.",
                httpStatus: 400);
        }

        if (monthlyRentRate < 0m || minimumLeaseMonths < 1 || securityDepositMonths < 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Monthly rent must be non-negative and MinimumLeaseMonths must be >= 1.",
                httpStatus: 400);
        }

        Code = code.Trim().ToUpperInvariant();
        Name = name;
        UnitTypeId = unitTypeId;
        SupportedStayModes = modes;

        BasePackageHours = basePackageHours;
        BasePackagePrice = decimal.Round(basePackagePrice, 2, MidpointRounding.AwayFromZero);
        AdditionalHourPrice = decimal.Round(additionalHourPrice, 2, MidpointRounding.AwayFromZero);
        GracePeriodMinutes = gracePeriodMinutes;
        AutoCapToDailyRate = decimal.Round(autoCapToDailyRate, 2, MidpointRounding.AwayFromZero);
        TurnaroundBufferMinutes = turnaroundBufferMinutes;

        WeekdayRate = decimal.Round(weekdayRate, 2, MidpointRounding.AwayFromZero);
        WeekendRate = decimal.Round(weekendRate, 2, MidpointRounding.AwayFromZero);
        HolidaySurchargeAmount = decimal.Round(holidaySurchargeAmount, 2, MidpointRounding.AwayFromZero);
        ExtraGuestPrice = decimal.Round(extraGuestPrice, 2, MidpointRounding.AwayFromZero);

        MonthlyRentRate = decimal.Round(monthlyRentRate, 2, MidpointRounding.AwayFromZero);
        MinimumLeaseMonths = minimumLeaseMonths;
        SecurityDepositMonths = securityDepositMonths;
        IsActive = isActive;
    }

    public HourlyRateRule ToHourlyRateRule() =>
        new(
            BasePackageHours: BasePackageHours,
            BasePackagePrice: BasePackagePrice,
            AdditionalHourPrice: AdditionalHourPrice,
            GracePeriodMinutes: GracePeriodMinutes,
            AutoCapToDailyRate: AutoCapToDailyRate,
            TurnaroundBufferMinutes: TurnaroundBufferMinutes,
            Name: Name);
}
