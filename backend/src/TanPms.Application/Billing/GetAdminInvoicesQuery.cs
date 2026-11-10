namespace TanPms.Application.Billing;

public sealed record GetAdminInvoicesQuery(
    Guid PropertyId,
    string? Period,
    string? Status,
    int? Page = null,
    int? PageSize = null);
