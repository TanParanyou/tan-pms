namespace TanPms.Application.Leases;

public sealed record CreateLeaseIntentRequest(
    string IntentType,
    DateOnly DesiredDate,
    string? Note = null);
