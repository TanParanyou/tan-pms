namespace TanPms.Application.Leases;

public sealed record DeleteAdminLeaseOccupantCommand(
    Guid PropertyId,
    Guid LeaseId,
    Guid OccupantId);
