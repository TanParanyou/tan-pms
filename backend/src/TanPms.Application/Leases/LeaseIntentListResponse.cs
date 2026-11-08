namespace TanPms.Application.Leases;

public sealed record LeaseIntentListResponse(
    IReadOnlyList<LeaseIntentDto> Items);
