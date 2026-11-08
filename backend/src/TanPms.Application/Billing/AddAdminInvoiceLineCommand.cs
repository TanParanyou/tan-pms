namespace TanPms.Application.Billing;

public sealed record AddAdminInvoiceLineCommand(
    Guid PropertyId,
    Guid InvoiceId,
    InvoiceLineRequest Request);
