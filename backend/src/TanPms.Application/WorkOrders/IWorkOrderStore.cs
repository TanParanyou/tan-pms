using TanPms.Application.Common.Results;

namespace TanPms.Application.WorkOrders;

public interface IWorkOrderStore
{
    Result<WorkOrderItemDto> CreateAdminWorkOrder(Guid propertyId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null);

    Result<WorkOrderItemDto> CreateClientWorkOrder(Guid customerId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null);

    Result<WorkOrderListResponse> GetAdminWorkOrders(Guid propertyId, string? status, bool unmaskPii = false);

    Result<WorkOrderListResponse> GetClientWorkOrders(Guid customerId, string? status);

    Result<WorkOrderItemDto> AssignAdminWorkOrder(Guid propertyId, Guid workOrderId, AssignWorkOrderRequest request);

    Result<WorkOrderItemDto> ResolveAdminWorkOrder(
        Guid propertyId,
        Guid workOrderId,
        ResolveWorkOrderRequest request,
        DateTimeOffset? nowUtc = null);
}
