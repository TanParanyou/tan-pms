namespace TanPms.Application.Cashier;

public sealed record CashierShiftListResponse(
    IReadOnlyList<CashierShiftDto> Items);
