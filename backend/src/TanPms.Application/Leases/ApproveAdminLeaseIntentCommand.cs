namespace TanPms.Application.Leases;

public sealed record ApproveAdminLeaseIntentCommand(
    Guid PropertyId,
    Guid IntentId);
