using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Leases;

public sealed record CancelAdminLeaseCommand(
    Guid PropertyId,
    Guid LeaseId,
    ReasonRequest Request);
