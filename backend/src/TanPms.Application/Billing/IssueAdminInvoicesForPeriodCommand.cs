namespace TanPms.Application.Billing;

public sealed record IssueAdminInvoicesForPeriodCommand(
    Guid PropertyId,
    IssueInvoicesRequest Request);
