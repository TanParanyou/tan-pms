using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TanPms.Application.Common.Results;
using TanPms.Application.Housekeeping;
using TanPms.Application.Parcels;
using TanPms.Application.WorkOrders;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Leases;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
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

        var query = _dbContext.HousekeepingTasks.AsNoTracking().Where(t => t.PropertyId == propertyId);
        if (statusFilter.HasValue)
        {
            query = query.Where(t => t.Status == statusFilter.Value);
        }

        var tasks = query.ToList();
        var unitIds = tasks.Select(t => t.UnitId).Distinct().ToList();
        var units = _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToDictionary(u => u.Id);
        var unitRefs = BuildUnitRefsForProperty(propertyId, units.Values.ToList());
        var buildingCodes = _dbContext.Buildings.AsNoTracking().Where(b => b.PropertyId == propertyId).ToDictionary(b => b.Id, b => b.Code);
        var floorNumbers = _dbContext.Floors.AsNoTracking().Where(f => f.PropertyId == propertyId).ToDictionary(f => f.Id, f => f.FloorNumber);

        var items = tasks
            .Select(t => (Task: t, Unit: units[t.UnitId]))
            .Where(x => !buildingId.HasValue || x.Unit.BuildingId == buildingId.Value)
            .OrderBy(x => buildingCodes.GetValueOrDefault(x.Unit.BuildingId, string.Empty), StringComparer.Ordinal)
            .ThenBy(x => floorNumbers.GetValueOrDefault(x.Unit.FloorId))
            .ThenBy(x => x.Unit.UnitNumber, StringComparer.Ordinal)
            .ThenBy(x => x.Task.CreatedAt)
            .Select(x => OperationsRecordMapper.MapHousekeepingTask(x.Task, unitRefs[x.Unit.Id], x.Unit))
            .ToList();
        return Result<HousekeepingTaskListResponse>.Success(new HousekeepingTaskListResponse(items));
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

        if (!_dbContext.Units.AsNoTracking().Any(u => u.Id == request.UnitId && u.PropertyId == propertyId))
        {
            return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotFound("Unit", propertyId, request.UnitId));
        }

        return Result<WorkOrderItemDto>.Success(AddWorkOrder(propertyId, request, priority, null, nowUtc));
    }

    public Result<WorkOrderItemDto> CreateClientWorkOrder(Guid customerId, CreateWorkOrderRequest request, DateTimeOffset? nowUtc = null)
    {
        if (WorkOrderRules.ValidateCreate(request, out var priority) is { } validationError)
        {
            return Result<WorkOrderItemDto>.Failure(validationError);
        }

        var unit = _dbContext.Units.AsNoTracking().FirstOrDefault(u => u.Id == request.UnitId);
        var (stay, lease) = FindActiveOccupancy(request.UnitId);
        if (unit is null || (stay?.CustomerId != customerId && lease?.CustomerId != customerId))
        {
            return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotUnitTenant());
        }

        return Result<WorkOrderItemDto>.Success(AddWorkOrder(unit.PropertyId, request, priority, customerId, nowUtc));
    }

    public Result<WorkOrderListResponse> GetAdminWorkOrders(Guid propertyId, string? status, bool unmaskPii = false) =>
        ListWorkOrders(w => w.PropertyId == propertyId, status, unmaskPii);

    public Result<WorkOrderListResponse> GetClientWorkOrders(Guid customerId, string? status) =>
        ListWorkOrders(w => w.ReportedByCustomerId == customerId, status, unmaskPii: false);

    public Result<WorkOrderItemDto> AssignAdminWorkOrder(Guid propertyId, Guid workOrderId, AssignWorkOrderRequest request)
    {
        var workOrder = _dbContext.WorkOrders.FirstOrDefault(w => w.Id == workOrderId && w.PropertyId == propertyId);
        if (workOrder is null)
        {
            return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NotFound("WorkOrder", propertyId, workOrderId));
        }

        try
        {
            workOrder.Assign(request.TechnicianUserId);
            _dbContext.SaveChanges();
            return Result<WorkOrderItemDto>.Success(MapWorkOrders([workOrder], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<WorkOrderItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
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

        using var tx = BeginTransactionIfNeeded();
        var workOrder = _dbContext.WorkOrders.FirstOrDefault(w => w.Id == workOrderId && w.PropertyId == propertyId);
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
                var (stay, lease) = FindActiveOccupancy(workOrder.UnitId);
                var taxMode = OperationsRecordMapper.ResolveRepairTaxMode(
                    _dbContext.TaxProfiles.AsNoTracking().Where(p => p.PropertyId == propertyId).ToList());
                var description = OperationsRecordMapper.RepairChargeDescription(workOrder);
                if (stay is not null)
                {
                    var folio = EnsureTrackedFolio(_dbContext.Stays.First(s => s.Id == stay.Id));
                    var existingChargeIds = folio.Charges.Select(c => c.Id).ToHashSet();
                    folio.AddCharge(description, request.RepairCostAmount, taxMode);
                    _dbContext.Set<FolioCharge>().AddRange(folio.Charges.Where(c => !existingChargeIds.Contains(c.Id)));
                    chargeDocumentNumber = stay.DocumentNumber;
                }
                else if (lease is not null)
                {
                    var invoice = _dbContext.Invoices
                        .Include(i => i.Lines)
                        .Where(i => i.LeaseId == lease.Id && i.Status == InvoiceStatus.Draft)
                        .OrderByDescending(i => i.CreatedAt)
                        .FirstOrDefault();
                    if (invoice is null)
                    {
                        var property = _dbContext.Properties.AsNoTracking().First(p => p.Id == propertyId);
                        invoice = new Invoice
                        {
                            PropertyId = propertyId,
                            DocumentNumber = _documentNumberService.NextDocumentNumberAsync(
                                property.Id, property.Code, DocumentTypeCode.INV, nowUtc ?? DateTimeOffset.UtcNow).GetAwaiter().GetResult(),
                            CustomerId = lease.CustomerId,
                            LeaseId = lease.Id
                        };
                        _dbContext.Invoices.Add(invoice);
                    }

                    var existingLineIds = invoice.Lines.Select(l => l.Id).ToHashSet();
                    invoice.AddLine(description, request.RepairCostAmount, taxMode);
                    _dbContext.Set<InvoiceLine>().AddRange(invoice.Lines.Where(l => !existingLineIds.Contains(l.Id)));
                    chargeDocumentNumber = invoice.DocumentNumber;
                }
                else
                {
                    var unit = _dbContext.Units.AsNoTracking().First(u => u.Id == workOrder.UnitId);
                    return Result<WorkOrderItemDto>.Failure(OperationsRecordMapper.NoActiveTenant(unit.UnitNumber));
                }
            }

            workOrder.Resolve(request.ResolutionNotes, request.AfterPhotoFileKey, request.RepairCostAmount, chargeDocumentNumber);
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<WorkOrderItemDto>.Success(MapWorkOrders([workOrder], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<WorkOrderItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<ParcelItemDto> ReceiveAdminParcel(Guid propertyId, ReceiveParcelRequest request, DateTimeOffset? nowUtc = null)
    {
        if (ParcelRules.ValidateReceive(request) is { } validationError)
        {
            return Result<ParcelItemDto>.Failure(validationError);
        }

        var unit = _dbContext.Units.AsNoTracking().FirstOrDefault(u => u.Id == request.UnitId && u.PropertyId == propertyId);
        if (unit is null)
        {
            return Result<ParcelItemDto>.Failure(OperationsRecordMapper.NotFound("Unit", propertyId, request.UnitId));
        }

        var (stay, lease) = FindActiveOccupancy(unit.Id);
        var customerId = stay?.CustomerId ?? lease?.CustomerId;
        if (customerId is null)
        {
            return Result<ParcelItemDto>.Failure(OperationsRecordMapper.NoActiveTenant(unit.UnitNumber));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        var property = _dbContext.Properties.AsNoTracking().First(p => p.Id == propertyId);
        var parcel = ParcelRules.Build(
            propertyId,
            _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.PCL, clockUtc).GetAwaiter().GetResult(),
            customerId.Value,
            request,
            clockUtc);
        _dbContext.Parcels.Add(parcel);
        _dbContext.NotificationMessages.Add(OperationsRecordMapper.BuildParcelNotification(parcel, unit.UnitNumber));
        _dbContext.SaveChanges();
        return Result<ParcelItemDto>.Success(MapParcels([parcel], unmaskPii: false)[0]);
    }

    public Result<ParcelListResponse> GetAdminParcels(Guid propertyId, string? status, bool unmaskPii = false) =>
        ListParcels(p => p.PropertyId == propertyId, status, unmaskPii);

    public Result<ParcelListResponse> GetClientParcels(Guid customerId, string? status) =>
        ListParcels(p => p.CustomerId == customerId, status, unmaskPii: false);

    public Result<ParcelItemDto> PickUpAdminParcel(Guid propertyId, Guid parcelId, PickUpParcelRequest request, DateTimeOffset? nowUtc = null)
    {
        var parcel = _dbContext.Parcels.FirstOrDefault(p => p.Id == parcelId && p.PropertyId == propertyId);
        if (parcel is null)
        {
            return Result<ParcelItemDto>.Failure(OperationsRecordMapper.NotFound("Parcel", propertyId, parcelId));
        }

        try
        {
            parcel.MarkPickedUp(nowUtc ?? DateTimeOffset.UtcNow, request.RecipientName);
            _dbContext.SaveChanges();
            return Result<ParcelItemDto>.Success(MapParcels([parcel], unmaskPii: false)[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ParcelItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private Result<HousekeepingTaskDto> MutateHousekeepingTask(Guid propertyId, Guid taskId, Action<HousekeepingTask, Unit> mutate)
    {
        var task = _dbContext.HousekeepingTasks.FirstOrDefault(t => t.Id == taskId && t.PropertyId == propertyId);
        if (task is null)
        {
            return Result<HousekeepingTaskDto>.Failure(OperationsRecordMapper.NotFound("HousekeepingTask", propertyId, taskId));
        }

        var unit = _dbContext.Units.First(u => u.Id == task.UnitId);
        try
        {
            mutate(task, unit);
            _dbContext.SaveChanges();
            return Result<HousekeepingTaskDto>.Success(OperationsRecordMapper.MapHousekeepingTask(task, BuildSingleUnitRef(unit), unit));
        }
        catch (DomainRuleException ex)
        {
            return Result<HousekeepingTaskDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private WorkOrderItemDto AddWorkOrder(
        Guid propertyId,
        CreateWorkOrderRequest request,
        WorkOrderPriority priority,
        Guid? reportedByCustomerId,
        DateTimeOffset? nowUtc)
    {
        var property = _dbContext.Properties.AsNoTracking().First(p => p.Id == propertyId);
        var workOrder = WorkOrderRules.Build(
            propertyId,
            _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.WKO, nowUtc ?? DateTimeOffset.UtcNow)
                .GetAwaiter().GetResult(),
            request,
            priority,
            reportedByCustomerId);
        _dbContext.WorkOrders.Add(workOrder);
        _dbContext.SaveChanges();
        return MapWorkOrders([workOrder], unmaskPii: false)[0];
    }

    private Result<WorkOrderListResponse> ListWorkOrders(Expression<Func<WorkOrder, bool>> scope, string? status, bool unmaskPii)
    {
        if (WorkOrderRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<WorkOrderListResponse>.Failure(statusError);
        }

        var query = _dbContext.WorkOrders.AsNoTracking().Where(scope);
        if (statusFilter.HasValue)
        {
            query = query.Where(w => w.Status == statusFilter.Value);
        }

        var workOrders = query.OrderByDescending(w => w.DocumentNumber).ToList();
        return Result<WorkOrderListResponse>.Success(new WorkOrderListResponse(MapWorkOrders(workOrders, unmaskPii)));
    }

    private Result<ParcelListResponse> ListParcels(Expression<Func<Parcel, bool>> scope, string? status, bool unmaskPii)
    {
        if (ParcelRules.ParseStatus(status, out var statusFilter) is { } statusError)
        {
            return Result<ParcelListResponse>.Failure(statusError);
        }

        var query = _dbContext.Parcels.AsNoTracking().Where(scope);
        if (statusFilter.HasValue)
        {
            query = query.Where(p => p.Status == statusFilter.Value);
        }

        var parcels = query.OrderByDescending(p => p.ArrivedAt).ToList();
        return Result<ParcelListResponse>.Success(new ParcelListResponse(MapParcels(parcels, unmaskPii)));
    }

    private (Stay? Stay, Lease? Lease) FindActiveOccupancy(Guid unitId) =>
        (_dbContext.Stays.AsNoTracking().FirstOrDefault(s => s.UnitId == unitId && s.Status == StayStatus.Active),
         _dbContext.Leases.AsNoTracking().FirstOrDefault(l => l.UnitId == unitId
             && (l.Status == LeaseStatus.Active || l.Status == LeaseStatus.MoveOutNotice)));

    private List<WorkOrderItemDto> MapWorkOrders(IReadOnlyList<WorkOrder> workOrders, bool unmaskPii)
    {
        var unitIds = workOrders.Select(w => w.UnitId).Distinct().ToList();
        var unitRefs = _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToList()
            .ToDictionary(u => u.Id, BuildSingleUnitRef);
        var reporterIds = workOrders.Where(w => w.ReportedByCustomerId.HasValue).Select(w => w.ReportedByCustomerId!.Value).Distinct().ToList();
        var reporters = _dbContext.Customers.AsNoTracking().Where(c => reporterIds.Contains(c.Id)).ToDictionary(c => c.Id);
        return workOrders.Select(w => OperationsRecordMapper.MapWorkOrder(
            w,
            unitRefs[w.UnitId],
            w.ReportedByCustomerId is { } reporterId ? reporters[reporterId] : null,
            unmaskPii)).ToList();
    }

    private List<ParcelItemDto> MapParcels(IReadOnlyList<Parcel> parcels, bool unmaskPii)
    {
        var unitIds = parcels.Select(p => p.UnitId).Distinct().ToList();
        var unitRefs = _dbContext.Units.AsNoTracking().Where(u => unitIds.Contains(u.Id)).ToList()
            .ToDictionary(u => u.Id, BuildSingleUnitRef);
        var customerIds = parcels.Select(p => p.CustomerId).Distinct().ToList();
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);
        return parcels.Select(p => OperationsRecordMapper.MapParcel(p, unitRefs[p.UnitId], customers[p.CustomerId], unmaskPii)).ToList();
    }
}
