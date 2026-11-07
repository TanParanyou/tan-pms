namespace TanPms.Application.Billing;

public sealed record IssueAdminInvoiceCommand(
    Guid PropertyId,
    Guid InvoiceId);
