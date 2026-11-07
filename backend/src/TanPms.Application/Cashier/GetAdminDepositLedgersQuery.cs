namespace TanPms.Application.Cashier;

public sealed record GetAdminDepositLedgersQuery(
    Guid PropertyId,
    string? DepositType);
