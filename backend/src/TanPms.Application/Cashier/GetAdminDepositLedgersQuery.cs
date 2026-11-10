namespace TanPms.Application.Cashier;

public sealed record GetAdminDepositLedgersQuery(
    Guid PropertyId,
    string? DepositType,
    int? Page = null,
    int? PageSize = null);
