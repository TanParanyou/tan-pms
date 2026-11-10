using TanPms.Application.Common.Models;
namespace TanPms.Application.Cashier;

public sealed record CashierShiftListResponse(
    IReadOnlyList<CashierShiftDto> Items,
    PaginationMetadata? Pagination = null);
