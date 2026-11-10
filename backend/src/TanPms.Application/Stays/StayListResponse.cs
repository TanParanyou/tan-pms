using TanPms.Application.Common.Models;
namespace TanPms.Application.Stays;

public sealed record StayListResponse(
    IReadOnlyList<StayDetailDto> Items,
    PaginationMetadata? Pagination = null);
