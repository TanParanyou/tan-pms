namespace TanPms.Application.Leases;

public sealed record CreateClientLeaseIntentCommand(
    Guid LeaseId,
    CreateLeaseIntentRequest Request);
