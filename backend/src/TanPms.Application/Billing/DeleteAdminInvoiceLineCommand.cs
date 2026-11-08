namespace TanPms.Application.Billing;

public sealed record DeleteAdminInvoiceLineCommand(
    Guid PropertyId,
    Guid InvoiceId,
    Guid LineId);
