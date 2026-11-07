namespace TanPms.Application.Billing;

public sealed record RunAdminBatchInvoicesCommand(
    Guid PropertyId,
    BatchInvoiceRunRequest Request);
