using TanPms.Application.Common.Models;
namespace TanPms.Application.Leases;

public sealed record LeaseIntentListResponse(
    IReadOnlyList<LeaseIntentDto> Items,
    PaginationMetadata? Pagination = null);
