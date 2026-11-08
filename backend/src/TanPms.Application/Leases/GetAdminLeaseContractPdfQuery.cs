namespace TanPms.Application.Leases;

public sealed record GetAdminLeaseContractPdfQuery(
    Guid PropertyId,
    Guid LeaseId);
