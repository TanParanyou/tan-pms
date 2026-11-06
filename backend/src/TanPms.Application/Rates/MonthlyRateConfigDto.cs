namespace TanPms.Application.Rates;

public sealed record MonthlyRateConfigDto(
    decimal MonthlyRentRate,
    int MinimumLeaseMonths,
    int SecurityDepositMonths);
