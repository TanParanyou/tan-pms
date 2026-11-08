using TanPms.Application.Common.Contracts;

namespace TanPms.Application.WorkOrders;

public sealed record CancelAdminWorkOrderCommand(
    Guid PropertyId,
    Guid WorkOrderId,
    ReasonRequest Request);
