namespace TanPms.Application.Cashier;

public sealed record GetAdminDepositLedgerQuery(
    Guid PropertyId,
    Guid LedgerId);
