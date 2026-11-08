namespace TanPms.Application.Leases;

public sealed record UpdateAdminLeaseVehicleCommand(
    Guid PropertyId,
    Guid LeaseId,
    Guid VehicleId,
    LeaseVehicleRequest Request);
