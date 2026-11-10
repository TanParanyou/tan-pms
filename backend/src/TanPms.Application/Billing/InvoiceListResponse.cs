using TanPms.Application.Common.Models;
namespace TanPms.Application.Billing;

public sealed record InvoiceListResponse(
    IReadOnlyList<InvoiceItemDto> Items,
    PaginationMetadata? Pagination = null);
