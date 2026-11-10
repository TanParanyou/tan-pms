namespace TanPms.Application.Cashier;

public sealed record GetAdminCashierShiftsQuery(
    Guid PropertyId,
    string? Status,
    int? Page = null,
    int? PageSize = null);
