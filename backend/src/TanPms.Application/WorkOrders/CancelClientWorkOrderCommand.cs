using TanPms.Application.Common.Contracts;

namespace TanPms.Application.WorkOrders;

public sealed record CancelClientWorkOrderCommand(
    Guid WorkOrderId,
    ReasonRequest Request);
