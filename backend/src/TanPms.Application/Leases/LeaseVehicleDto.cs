namespace TanPms.Application.Leases;

public sealed record LeaseVehicleDto(
    Guid Id,
    string LicensePlate,
    string Province,
    string VehicleBrandModel);
