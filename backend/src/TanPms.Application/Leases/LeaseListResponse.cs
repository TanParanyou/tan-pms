namespace TanPms.Application.Leases;

public sealed record LeaseListResponse(
    IReadOnlyList<LeaseItemDto> Items);
