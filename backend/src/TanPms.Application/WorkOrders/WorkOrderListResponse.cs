namespace TanPms.Application.WorkOrders;

public sealed record WorkOrderListResponse(
    IReadOnlyList<WorkOrderItemDto> Items);
