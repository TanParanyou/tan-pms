namespace TanPms.Application.Billing;

public sealed record DeleteAdminInvoiceCommand(
    Guid PropertyId,
    Guid InvoiceId);
