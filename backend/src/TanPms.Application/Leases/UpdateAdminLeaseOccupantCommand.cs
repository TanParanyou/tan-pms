namespace TanPms.Application.Leases;

public sealed record UpdateAdminLeaseOccupantCommand(
    Guid PropertyId,
    Guid LeaseId,
    Guid OccupantId,
    UpdateLeaseOccupantRequest Request);
