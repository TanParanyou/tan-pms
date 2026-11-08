namespace TanPms.Application.WorkOrders;

public sealed record CreateAdminWorkOrderCommand(
    Guid PropertyId,
    CreateWorkOrderRequest Request);
