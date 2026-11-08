using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Housekeeping;
using TanPms.Application.Parcels;
using TanPms.Application.WorkOrders;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Notifications;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;

namespace TanPms.Infrastructure.Services;

// Shared by the EF Core and in-memory stores so housekeeping, work order and parcel projections stay identical.
internal static class OperationsRecordMapper
{
    internal static HousekeepingTaskDto MapHousekeepingTask(HousekeepingTask task, UnitRefDto unitRef, Unit unit) => new(
        task.Id,
        unitRef,
        task.SourceDocumentNumber,
        task.Status.ToString(),
        unit.ConditionStatus.ToString(),
        task.AssignedStaffUserId,
        task.CreatedAt,
        task.UpdatedAt);

    internal static WorkOrderItemDto MapWorkOrder(WorkOrder workOrder, UnitRefDto unitRef, Customer? reporter, bool unmaskPii) => new(
        workOrder.Id,
        workOrder.PropertyId,
        workOrder.DocumentNumber,
        workOrder.Status.ToString(),
        workOrder.Priority.ToString(),
        unitRef,
        workOrder.IssueSummary,
        workOrder.Description,
        reporter is null ? null : MapCustomer(reporter, unmaskPii),
        workOrder.AssignedTechnicianUserId,
        workOrder.BeforePhotoFileKey,
        workOrder.AfterPhotoFileKey,
        workOrder.ResolutionNotes,
        workOrder.TenantChargeAmount,
        workOrder.ChargeDocumentNumber,
        workOrder.CreatedAt,
        workOrder.UpdatedAt);

    internal static ParcelItemDto MapParcel(Parcel parcel, UnitRefDto unitRef, Customer customer, bool unmaskPii) => new(
        parcel.Id,
        parcel.PropertyId,
        parcel.DocumentNumber,
        parcel.Status.ToString(),
        unitRef,
        MapCustomer(customer, unmaskPii),
        parcel.CarrierName,
        parcel.TrackingNumber,
        parcel.ParcelPhotoFileKey,
        parcel.ArrivedAt,
        parcel.PickedUpAt,
        parcel.RecipientName);

    internal static NotificationMessage BuildParcelNotification(Parcel parcel, string unitNumber) => new()
    {
        PropertyId = parcel.PropertyId,
        CustomerId = parcel.CustomerId,
        Channel = NotificationChannel.InApp,
        TemplateKey = ParcelRules.ArrivedTemplateKey,
        Title = ParcelRules.ArrivedTitle(parcel.DocumentNumber),
        Body = ParcelRules.ArrivedBody(parcel.CarrierName, unitNumber),
        SentAtUtc = parcel.ArrivedAt
    };

    internal static LocalizedText RepairChargeDescription(WorkOrder workOrder)
    {
        var summary = workOrder.IssueSummary.Length > 150 ? workOrder.IssueSummary[..150] : workOrder.IssueSummary;
        return LocalizedText.Create(
            $"ค่าซ่อม {workOrder.DocumentNumber}: {summary}",
            $"Repair charge {workOrder.DocumentNumber}: {summary}");
    }

    internal static TaxMode ResolveRepairTaxMode(IEnumerable<TaxProfile> propertyProfiles) =>
        propertyProfiles.FirstOrDefault(p => p.IsActive && p.ChargeCategoryCode == WorkOrderRules.RepairChargeCategory)?.TaxMode
        ?? TaxMode.VatIncluded;

    internal static Error NotFound(string entity, Guid propertyId, Guid id) =>
        new(DomainErrorCodes.ValidationFailed, $"{entity} '{id}' was not found in property '{propertyId}'.");

    internal static Error NoActiveTenant(string unitNumber) =>
        new(DomainErrorCodes.ValidationFailed, $"Unit {unitNumber} has no active Stay or Lease tenant.");

    internal static Error NotUnitTenant() =>
        new(DomainErrorCodes.PermissionDenied, "Customer does not have an active Stay or Lease on this unit.");

    private static CustomerRefDto MapCustomer(Customer customer, bool unmaskPii) => new(
        customer.Id,
        customer.FullName,
        unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity());
}
