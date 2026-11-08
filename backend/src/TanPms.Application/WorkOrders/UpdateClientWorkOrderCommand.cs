namespace TanPms.Application.WorkOrders;

public sealed record UpdateClientWorkOrderCommand(
    Guid WorkOrderId,
    UpdateWorkOrderRequest Request);
