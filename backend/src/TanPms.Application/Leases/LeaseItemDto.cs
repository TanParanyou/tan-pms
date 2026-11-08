using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Leases;

public sealed record LeaseItemDto(
    Guid Id,
    string DocumentNumber,
    string Status,
    UnitRefDto Unit,
    CustomerRefDto Customer,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal MonthlyRentAmount,
    decimal SecurityDepositAmount,
    decimal SecurityDepositBalance,
    decimal InitialWaterMeterReading,
    decimal InitialElectricMeterReading,
    IReadOnlyList<LeaseOccupantDto> Occupants,
    IReadOnlyList<LeaseVehicleDto> Vehicles,
    string? CancelReason);
