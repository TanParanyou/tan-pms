namespace TanPms.Application.Leases;

public sealed record UpdateLeaseRequest(
    decimal? MonthlyRentAmount,
    decimal? InitialWaterMeterReading,
    decimal? InitialElectricMeterReading,
    string Reason);
