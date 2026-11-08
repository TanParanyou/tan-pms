namespace TanPms.Application.WorkOrders;

public sealed record ResolveAdminWorkOrderCommand(
    Guid PropertyId,
    Guid WorkOrderId,
    ResolveWorkOrderRequest Request);
