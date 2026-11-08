namespace TanPms.Application.Billing;

public sealed record BatchInvoiceRunResponse(
    string Period,
    IReadOnlyList<InvoiceItemDto> Created,
    IReadOnlyList<InvoiceItemDto> Refreshed,
    IReadOnlyList<BatchInvoiceSkipDto> Skipped);
