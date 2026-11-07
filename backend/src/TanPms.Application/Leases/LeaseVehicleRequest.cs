namespace TanPms.Application.Leases;

public sealed record LeaseVehicleRequest(
    string LicensePlate,
    string? Province,
    string? VehicleBrandModel);
