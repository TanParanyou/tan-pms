namespace TanPms.Application.WorkOrders;

public sealed record UpdateAdminWorkOrderCommand(
    Guid PropertyId,
    Guid WorkOrderId,
    UpdateWorkOrderRequest Request);
