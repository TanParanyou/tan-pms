namespace TanPms.Application.Billing;

public sealed record GetClientInvoicesQuery(
    string? Status,
    int? Page = null,
    int? PageSize = null);
