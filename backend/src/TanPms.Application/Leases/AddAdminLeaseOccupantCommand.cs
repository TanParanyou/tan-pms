namespace TanPms.Application.Leases;

public sealed record AddAdminLeaseOccupantCommand(
    Guid PropertyId,
    Guid LeaseId,
    LeaseOccupantRequest Request);
