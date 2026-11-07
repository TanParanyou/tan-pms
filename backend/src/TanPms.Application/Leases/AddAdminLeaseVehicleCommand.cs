namespace TanPms.Application.Leases;

public sealed record AddAdminLeaseVehicleCommand(
    Guid PropertyId,
    Guid LeaseId,
    LeaseVehicleRequest Request);
