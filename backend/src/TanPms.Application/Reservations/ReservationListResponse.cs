using TanPms.Application.Common.Models;
namespace TanPms.Application.Reservations;

public sealed record ReservationListResponse(
    IReadOnlyList<ReservationItemDto> Items,
    PaginationMetadata? Pagination = null);
