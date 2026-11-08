namespace TanPms.Application.Billing;

public sealed record GetAdminInvoiceQuery(
    Guid PropertyId,
    Guid InvoiceId);
