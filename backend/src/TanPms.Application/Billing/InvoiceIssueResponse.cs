namespace TanPms.Application.Billing;

public sealed record InvoiceIssueResponse(
    IReadOnlyList<InvoiceItemDto> Issued);
