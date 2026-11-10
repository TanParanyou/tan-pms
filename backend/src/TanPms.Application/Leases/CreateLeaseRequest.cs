namespace TanPms.Application.Leases;

public sealed record CreateLeaseRequest(
    Guid UnitId,
    Guid CustomerId,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal MonthlyRentAmount,
    decimal SecurityDepositAmount,
    decimal InitialWaterMeterReading,
    decimal InitialElectricMeterReading,
    IReadOnlyList<LeaseOccupantRequest>? Occupants = null,
    IReadOnlyList<LeaseVehicleRequest>? Vehicles = null,
    string? PaymentMethod = null);
