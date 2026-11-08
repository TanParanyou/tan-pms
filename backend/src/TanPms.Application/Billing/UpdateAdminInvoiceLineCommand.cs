namespace TanPms.Application.Billing;

public sealed record UpdateAdminInvoiceLineCommand(
    Guid PropertyId,
    Guid InvoiceId,
    Guid LineId,
    InvoiceLineRequest Request);
