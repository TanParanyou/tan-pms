namespace TanPms.Application.Billing;

public sealed record InvoiceListResponse(
    IReadOnlyList<InvoiceItemDto> Items);
