namespace TanPms.Application.WorkOrders;

public sealed record GetAdminWorkOrderQuery(
    Guid PropertyId,
    Guid WorkOrderId);
