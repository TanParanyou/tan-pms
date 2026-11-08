using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Leases;

public sealed record RejectAdminLeaseIntentCommand(
    Guid PropertyId,
    Guid IntentId,
    ReasonRequest Request);
