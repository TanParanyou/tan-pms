using TanPms.Application.Common.Models;
namespace TanPms.Application.Billing;

public sealed record ClientInvoiceListResponse(
    IReadOnlyList<ClientInvoiceDto> Items,
    PaginationMetadata? Pagination = null);
