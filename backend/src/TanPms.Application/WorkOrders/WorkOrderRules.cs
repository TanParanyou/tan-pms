using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Operations;

namespace TanPms.Application.WorkOrders;

// Shared validation so both persistence providers reject the same work order input.
public static class WorkOrderRules
{
    // TaxProfile.ChargeCategoryCode for tenant repair charges; VatIncluded when no active profile exists.
    public const string RepairChargeCategory = "REPAIR_CHARGE";
    public const string ClientUpdateActionKey = "client.workorders.update";
    public const string ClientCancelActionKey = "client.workorders.cancel";

    public static Error? ValidateCreate(CreateWorkOrderRequest request, out WorkOrderPriority priority)
    {
        priority = WorkOrderPriority.Normal;
        if (request.UnitId == Guid.Empty || string.IsNullOrWhiteSpace(request.IssueSummary))
        {
            return new Error(DomainErrorCodes.ValidationFailed, "UnitId and IssueSummary are required.");
        }

        if (request.IssueSummary.Trim().Length > 200)
        {
            return new Error(DomainErrorCodes.ValidationFailed, "IssueSummary cannot exceed 200 characters.");
        }

        if (!string.IsNullOrWhiteSpace(request.Priority)
            && (!Enum.TryParse(request.Priority, ignoreCase: true, out priority) || !Enum.IsDefined(priority)))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid WorkOrderPriority '{request.Priority}'.");
        }

        return null;
    }

    public static Error? ValidateUpdate(UpdateWorkOrderRequest request, out WorkOrderPriority priority) =>
        ValidateCreate(
            new CreateWorkOrderRequest(Guid.NewGuid(), request.IssueSummary, request.Description, request.Priority, request.BeforePhotoFileKey),
            out priority);

    // Clients may edit/cancel only their own Open work order; anything else is reported as not found (403).
    public static Error? CheckClientCanChange(WorkOrder? workOrder, Guid customerId)
    {
        if (workOrder is null || workOrder.ReportedByCustomerId != customerId)
        {
            return new Error(DomainErrorCodes.PermissionDenied, "Work order was not found for the current customer.");
        }

        return workOrder.Status == WorkOrderStatus.Open
            ? null
            : new Error(DomainErrorCodes.ValidationFailed, $"Work order {workOrder.DocumentNumber} can only be changed while Open (current: {workOrder.Status}).");
    }

    public static Error? ValidateResolve(ResolveWorkOrderRequest request) =>
        request.RepairCostAmount < 0m
            ? new Error(DomainErrorCodes.ValidationFailed, "RepairCostAmount cannot be negative.")
            : request.ChargeToTenant && request.RepairCostAmount <= 0m
                ? new Error(DomainErrorCodes.ValidationFailed, "RepairCostAmount must be greater than zero to charge the tenant.")
                : null;

    public static Error? ParseStatus(string? status, out WorkOrderStatus? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        if (!Enum.TryParse<WorkOrderStatus>(status, ignoreCase: true, out var value) || !Enum.IsDefined(value))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid WorkOrderStatus '{status}'.");
        }

        parsed = value;
        return null;
    }

    public static WorkOrder Build(Guid propertyId, string documentNumber, CreateWorkOrderRequest request, WorkOrderPriority priority, Guid? reportedByCustomerId) => new()
    {
        PropertyId = propertyId,
        DocumentNumber = documentNumber,
        UnitId = request.UnitId,
        ReportedByCustomerId = reportedByCustomerId,
        IssueSummary = request.IssueSummary.Trim(),
        Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
        Priority = priority,
        BeforePhotoFileKey = string.IsNullOrWhiteSpace(request.BeforePhotoFileKey) ? null : request.BeforePhotoFileKey.Trim()
    };
}
