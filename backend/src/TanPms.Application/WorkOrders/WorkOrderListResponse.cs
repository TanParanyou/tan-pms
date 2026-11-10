using TanPms.Application.Common.Models;
namespace TanPms.Application.WorkOrders;

public sealed record WorkOrderListResponse(
    IReadOnlyList<WorkOrderItemDto> Items,
    PaginationMetadata? Pagination = null);
