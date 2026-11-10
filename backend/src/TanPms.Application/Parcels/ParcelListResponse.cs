using TanPms.Application.Common.Models;
namespace TanPms.Application.Parcels;

public sealed record ParcelListResponse(
    IReadOnlyList<ParcelItemDto> Items,
    PaginationMetadata? Pagination = null);
