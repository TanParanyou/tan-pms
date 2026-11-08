using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;

namespace TanPms.Application.WorkOrders;

public interface IWorkOrderStore
{
    Result<WorkOrderItemDto> CreateAdminWorkOrder(Guid propertyId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null);

    Result<WorkOrderItemDto> CreateClientWorkOrder(Guid customerId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null);

    Result<WorkOrderListResponse> GetAdminWorkOrders(Guid propertyId, string? status, bool unmaskPii = false);

    Result<WorkOrderListResponse> GetClientWorkOrders(Guid customerId, string? status);

    Result<WorkOrderItemDto> GetAdminWorkOrder(Guid propertyId, Guid workOrderId, bool unmaskPii = false);

    Result<WorkOrderItemDto> GetClientWorkOrder(Guid customerId, Guid workOrderId);

    Result<WorkOrderItemDto> UpdateAdminWorkOrder(Guid propertyId, Guid workOrderId, UpdateWorkOrderRequest request);

    Result<WorkOrderItemDto> UpdateClientWorkOrder(Guid customerId, Guid workOrderId, UpdateWorkOrderRequest request);

    Result<WorkOrderItemDto> CancelAdminWorkOrder(Guid propertyId, Guid workOrderId, ReasonRequest request);

    Result<WorkOrderItemDto> CancelClientWorkOrder(Guid customerId, Guid workOrderId, ReasonRequest request);

    Result<WorkOrderItemDto> AssignAdminWorkOrder(Guid propertyId, Guid workOrderId, AssignWorkOrderRequest request);

    Result<WorkOrderItemDto> ResolveAdminWorkOrder(
        Guid propertyId,
        Guid workOrderId,
        ResolveWorkOrderRequest request,
        DateTimeOffset? nowUtc = null);
}
