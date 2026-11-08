namespace TanPms.Application.Leases;

public sealed record DeleteAdminLeaseVehicleCommand(
    Guid PropertyId,
    Guid LeaseId,
    Guid VehicleId);
