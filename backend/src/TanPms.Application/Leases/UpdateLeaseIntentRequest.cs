namespace TanPms.Application.Leases;

public sealed record UpdateLeaseIntentRequest(
    DateOnly DesiredDate,
    string? Note = null);
