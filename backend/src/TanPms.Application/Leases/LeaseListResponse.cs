using TanPms.Application.Common.Models;
namespace TanPms.Application.Leases;

public sealed record LeaseListResponse(
    IReadOnlyList<LeaseItemDto> Items,
    PaginationMetadata? Pagination = null);
