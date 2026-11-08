namespace TanPms.Application.Leases;

public sealed record UpdateClientLeaseIntentCommand(
    Guid IntentId,
    UpdateLeaseIntentRequest Request);
