namespace TanPms.Application.Cashier;

public sealed record DepositLedgerListResponse(
    IReadOnlyList<DepositLedgerItemDto> Items,
    decimal TotalHeldBalance);
