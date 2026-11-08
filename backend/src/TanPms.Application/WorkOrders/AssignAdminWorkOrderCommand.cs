namespace TanPms.Application.WorkOrders;

public sealed record AssignAdminWorkOrderCommand(
    Guid PropertyId,
    Guid WorkOrderId,
    AssignWorkOrderRequest Request);
