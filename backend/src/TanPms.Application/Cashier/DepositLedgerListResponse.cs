using TanPms.Application.Common.Models;
namespace TanPms.Application.Cashier;

public sealed record DepositLedgerListResponse(
    IReadOnlyList<DepositLedgerItemDto> Items,
    decimal TotalHeldBalance,
    PaginationMetadata? Pagination = null);
