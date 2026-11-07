namespace TanPms.Application.Leases;

public sealed record RenewLeaseRequest(
    DateOnly NewEndDate,
    decimal? NewMonthlyRentAmount = null);
