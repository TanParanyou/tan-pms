using TanPms.Application.Common.Results;
using TanPms.Application.Housekeeping;
using TanPms.Application.Parcels;
using TanPms.Application.WorkOrders;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Leases;
using TanPms.Domain.Operations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<WorkOrder> _workOrders = [];

    public Result<HousekeepingTaskListResponse> GetAdminHousekeepingTasks(Guid propertyId, string? status, Guid? buildingId)
    {
        HousekeepingTaskStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<HousekeepingTaskStatus>(status, ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed))
            {
                return Result<HousekeepingTaskListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid HousekeepingTaskStatus '{status}'."));
            }

            statusFilter = parsed;
        }

        lock (_syncRoot)
        {
            var items = _housekeepingTasks
                .Where(t => t.PropertyId == propertyId && (!statusFilter.HasValue || t.Status == statusFilter.Value))
                .Select(t => (Task: t, Unit: _units[t.UnitId]))
                .Where(x => !buildingId.HasValue || x.Unit.BuildingId == buildingId.Value)
                .OrderBy(x => _buildings.TryGetValue(x.Unit.BuildingId, out var b) ? b.Code : string.Empty, StringComparer.Ordinal)
                .ThenBy(x => _floors.TryGetValue(x.Unit.FloorId, out var f) ? f.FloorNumber : 0)
                .ThenBy(x => x.Unit.UnitNumber, StringComparer.Ordinal)
                .ThenBy(x => x.Task.CreatedAt)
                .Select(x => OperationsRecordMapper.MapHousekeepingTask(x.Task, _unitRefs[x.Unit.Id], x.Unit))
                .ToList();
            return Result<HousekeepingTaskListResponse>.Success(new HousekeepingTaskListResponse(items));
        }
    }

    public Result<HousekeepingTaskDto> StartAdminHousekeepingTask(Guid propertyId, Guid taskId) =>
        MutateHousekeepingTask(propertyId, taskId, (task, unit) => task.Start(unit));

    public Result<HousekeepingTaskDto> CompleteAdminHousekeepingTask(Guid propertyId, Guid taskId, CompleteHousekeepingTaskRequest request) =>
        MutateHousekeepingTask(propertyId, taskId, (task, unit) => task.Complete(unit, request.SkipInspection));

    public Result<HousekeepingTaskDto> AssignAdminHousekeepingTask(Guid propertyId, Guid taskId, AssignHousekeepingTaskRequest request) =>
        MutateHousekeepingTask(propertyId, taskId, (task, _) => task.Assign(request.AssignedStaffUserId));

    public Result<WorkOrderItemDto> CreateAdminWorkOrder(Guid propertyId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null)
    {
        if (WorkOrderRules.ValidateCreate(request, out var priority) is { } validationError)
        {
            return Result<WorkOrderItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            if (!_units.TryGetValue(request.UnitId, out var unit) || unit.PropertyId != propertyId)
            {
                return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotFound("Unit", propertyId, request.UnitId));
            }

            return Result<WorkOrderItemDto>.Success(AddWorkOrderLocked(propertyId, request, priority, null, nowUtc));
        }
    }

    public Result<WorkOrderItemDto> CreateClientWorkOrder(Guid customerId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null)
    {
        if (WorkOrderRules.ValidateCreate(request, out var priority) is { } validationError)
        {
            return Result<WorkOrderItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            var (stay, lease) = FindActiveOccupancyLocked(request.UnitId);
            if (!_units.TryGetValue(request.UnitId, out var unit) || (stay?.CustomerId != customerId && lease?.CustomerId != customerId))
            {
                return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotUnitTenant());
            }

            return Result<WorkOrderItemDto>.Success(AddWorkOrderLocked(unit.PropertyId, request, priority, customerId, nowUtc));
        }
    }

    public Result<WorkOrderListResponse> GetAdminWorkOrders(Guid propertyId, string? status, bool unmaskPii = false) =>
        ListWorkOrders(w => w.PropertyId == propertyId, status, unmaskPii);

    public Result<WorkOrderListResponse> GetClientWorkOrders(Guid customerId, string? status) =>
        ListWorkOrders(w => w.ReportedByCustomerId == customerId, status, unmaskPii: false);

    public Result<WorkOrderItemDto> AssignAdminWorkOrder(Guid propertyId, Guid workOrderId, AssignWorkOrderRequest request)
    {
        lock (_syncRoot)
        {
            var workOrder = _workOrders.FirstOrDefault(w => w.Id == workOrderId && w.PropertyId == propertyId);
            if (workOrder is null)
            {
                return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotFound("WorkOrder", propertyId, workOrderId));
            }

            try
            {
                workOrder.Assign(request.TechnicianUserId);
                return Result<WorkOrderItemDto>.Success(MapWorkOrderLocked(workOrder, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<WorkOrderItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<WorkOrderItemDto> ResolveAdminWorkOrder(
        Guid propertyId,
        Guid workOrderId,
        ResolveWorkOrderRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (WorkOrderRules.ValidateResolve(request) is { } validationError)
        {
            return Result<WorkOrderItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            var workOrder = _workOrders.FirstOrDefault(w => w.Id == workOrderId && w.PropertyId == propertyId);
            if (workOrder is null)
            {
                return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotFound("WorkOrder", propertyId, workOrderId));
            }

            try
            {
                workOrder.EnsureCanResolve(request.ResolutionNotes, request.RepairCostAmount);
                string? chargeDocumentNumber = null;
                if (request.ChargeToTenant)
                {
                    var (stay, lease) = FindActiveOccupancyLocked(workOrder.UnitId);
                    var taxMode = OperationsRecordMapper.ResolveRepairTaxMode(_taxProfiles.Values.Where(p => p.PropertyId == propertyId));
                    var description = OperationsRecordMapper.RepairChargeDescription(workOrder);
                    if (stay is not null)
                    {
                        EnsureFolioLocked(stay).AddCharge(description, request.RepairCostAmount, taxMode);
                        chargeDocumentNumber = stay.DocumentNumber;
                    }
                    else if (lease is not null)
                    {
                        var invoice = _invoices
                            .Where(i => i.LeaseId == lease.Id && i.Status == InvoiceStatus.Draft)
                            .OrderByDescending(i => i.CreatedAt)
                            .FirstOrDefault();
                        if (invoice is null)
                        {
                            var property = _properties[propertyId];
                            invoice = new Invoice
                            {
                                PropertyId = propertyId,
                                DocumentNumber = NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.INV, nowUtc ?? DateTimeOffset.UtcNow)
                                    .GetAwaiter().GetResult(),
                                CustomerId = lease.CustomerId,
                                LeaseId = lease.Id
                            };
                            _invoices.Add(invoice);
                        }

                        invoice.AddLine(description, request.RepairCostAmount, taxMode);
                        chargeDocumentNumber = invoice.DocumentNumber;
                    }
                    else
                    {
                        return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NoActiveTenant(_unitRefs[workOrder.UnitId].UnitNumber));
                    }
                }

                workOrder.Resolve(request.ResolutionNotes, request.AfterPhotoFileKey, request.RepairCostAmount, chargeDocumentNumber);
                return Result<WorkOrderItemDto>.Success(MapWorkOrderLocked(workOrder, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<WorkOrderItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<ParcelItemDto> ReceiveAdminParcel(Guid propertyId, ReceiveParcelRequest request, DateTimeOffset? nowUtc = null)
    {
        if (ParcelRules.ValidateReceive(request) is { } validationError)
        {
            return Result<ParcelItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            if (!_units.TryGetValue(request.UnitId, out var unit) || unit.PropertyId != propertyId)
            {
                return Result<ParcelItemDto>.Failure(OperationsRecordMapper.NotFound("Unit", propertyId, request.UnitId));
            }

            var (stay, lease) = FindActiveOccupancyLocked(unit.Id);
            var customerId = stay?.CustomerId ?? lease?.CustomerId;
            if (customerId is null)
            {
                return Result<ParcelItemDto>.Failure(OperationsRecordMapper.NoActiveTenant(unit.UnitNumber));
            }

            var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
            var property = _properties[propertyId];
            var parcel = ParcelRules.Build(
                propertyId,
                NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.PCL, clockUtc).GetAwaiter().GetResult(),
                customerId.Value,
                request,
                clockUtc);
            _parcels.Add(parcel);
            _notifications.Add(OperationsRecordMapper.BuildParcelNotification(parcel, unit.UnitNumber));
            return Result<ParcelItemDto>.Success(MapParcelLocked(parcel, unmaskPii: false));
        }
    }

    public Result<ParcelListResponse> GetAdminParcels(Guid propertyId, string? status, bool unmaskPii = false) =>
        ListParcels(p => p.PropertyId == propertyId, status, unmaskPii);

    public Result<ParcelListResponse> GetClientParcels(Guid customerId, string? status) =>
        ListParcels(p => p.CustomerId == customerId, status, unmaskPii: false);

    public Result<ParcelItemDto> PickUpAdminParcel(Guid propertyId, Guid parcelId, PickUpParcelRequest request, DateTimeOffset? nowUtc = null)
    {
        lock (_syncRoot)
        {
            var parcel = _parcels.FirstOrDefault(p => p.Id == parcelId && p.PropertyId == propertyId);
            if (parcel is null)
            {
                return Result<ParcelItemDto>.Failure(OperationsRecordMapper.NotFound("Parcel", propertyId, parcelId));
            }

            try
            {
                parcel.MarkPickedUp(nowUtc ?? DateTimeOffset.UtcNow, request.RecipientName);
                return Result<ParcelItemDto>.Success(MapParcelLocked(parcel, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<ParcelItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private Result<HousekeepingTaskDto> MutateHousekeepingTask(
        Guid propertyId,
        Guid taskId,
        Action<HousekeepingTask, Domain.Properties.Unit> mutate)
    {
        lock (_syncRoot)
        {
            var task = _housekeepingTasks.FirstOrDefault(t => t.Id == taskId && t.PropertyId == propertyId);
            if (task is null)
            {
                return Result<HousekeepingTaskDto>.Failure(OperationsRecordMapper.NotFound("HousekeepingTask", propertyId, taskId));
            }

            var unit = _units[task.UnitId];
            try
            {
                mutate(task, unit);
                return Result<HousekeepingTaskDto>.Success(OperationsRecordMapper.MapHousekeepingTask(task, _unitRefs[unit.Id], unit));
            }
            catch (DomainRuleException ex)
            {
                return Result<HousekeepingTaskDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private WorkOrderItemDto AddWorkOrderLocked(
        Guid propertyId,
        CreateWorkOrderRequest request,
        WorkOrderPriority priority,
        Guid? reportedByCustomerId,
        DateTimeOffset? nowUtc)
    {
        var property = _properties[propertyId];
        var workOrder = WorkOrderRules.Build(
            propertyId,
            NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.WKO, nowUtc ?? DateTimeOffset.UtcNow).GetAwaiter().GetResult(),
            request,
            priority,
            reportedByCustomerId);
        _workOrders.Add(workOrder);
        return MapWorkOrderLocked(workOrder, unmaskPii: false);
    }

    private Result<WorkOrderListResponse> ListWorkOrders(Func<WorkOrder, bool> scope, string? status, bool unmaskPii)
    {
        if (WorkOrderRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<WorkOrderListResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            var items = _workOrders
                .Where(scope)
                .Where(w => !statusFilter.HasValue || w.Status == statusFilter.Value)
                .OrderByDescending(w => w.DocumentNumber, StringComparer.Ordinal)
                .Select(w => MapWorkOrderLocked(w, unmaskPii))
                .ToList();
            return Result<WorkOrderListResponse>.Success(new WorkOrderListResponse(items));
        }
    }

    private Result<ParcelListResponse> ListParcels(Func<Parcel, bool> scope, string? status, bool unmaskPii)
    {
        if (ParcelRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<ParcelListResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            var items = _parcels
                .Where(scope)
                .Where(p => !statusFilter.HasValue || p.Status == statusFilter.Value)
                .OrderByDescending(p => p.ArrivedAt)
                .Select(p => MapParcelLocked(p, unmaskPii))
                .ToList();
            return Result<ParcelListResponse>.Success(new ParcelListResponse(items));
        }
    }

    private (Stay? Stay, Lease? Lease) FindActiveOccupancyLocked(Guid unitId) =>
        (_stays.FirstOrDefault(s => s.UnitId == unitId && s.Status == StayStatus.Active),
         _leases.FirstOrDefault(l => l.UnitId == unitId && l.BlocksUnitAvailability));

    private WorkOrderItemDto MapWorkOrderLocked(WorkOrder workOrder, bool unmaskPii) =>
        OperationsRecordMapper.MapWorkOrder(
            workOrder,
            _unitRefs[workOrder.UnitId],
            workOrder.ReportedByCustomerId is { } reporterId ? _customers[reporterId] : null,
            unmaskPii);

    private ParcelItemDto MapParcelLocked(Parcel parcel, bool unmaskPii) =>
        OperationsRecordMapper.MapParcel(parcel, _unitRefs[parcel.UnitId], _customers[parcel.CustomerId], unmaskPii);
}
