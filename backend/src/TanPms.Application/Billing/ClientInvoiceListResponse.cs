namespace TanPms.Application.Billing;

public sealed record ClientInvoiceListResponse(
    IReadOnlyList<ClientInvoiceDto> Items);
