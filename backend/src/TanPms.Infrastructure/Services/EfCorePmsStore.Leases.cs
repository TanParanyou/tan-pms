using Microsoft.EntityFrameworkCore;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Leases;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Leases;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<LeaseListResponse> GetAdminLeases(
        Guid propertyId,
        string? status,
        string? licensePlate,
        bool unmaskPii = false)
    {
        if (LeaseRequestValidation.ParseStatusFilter(status, out var statusFilter) is { } statusError)
        {
            return Result<LeaseListResponse>.Failure(statusError);
        }

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<LeaseListResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        var query = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId);
        if (statusFilter.HasValue)
        {
            query = query.Where(l => l.Status == statusFilter.Value);
        }

        var leases = query
            .OrderByDescending(l => l.StartDate)
            .ThenByDescending(l => l.DocumentNumber)
            .ToList();

        var plateQuery = LicensePlateNormalizer.Normalize(licensePlate);
        if (plateQuery.Length > 0)
        {
            // shortcut: plate normalization runs in memory per property; move to a normalized column if lease volume grows large.
            var vehicleLeaseIds = _dbContext.TenantVehicles
                .AsNoTracking()
                .Where(v => v.PropertyId == propertyId)
                .Select(v => new { v.LeaseId, Plate = v.LicensePlate })
                .ToList();
            var occupantLeaseIds = _dbContext.Occupants
                .AsNoTracking()
                .Where(o => o.PropertyId == propertyId && o.LeaseId != null && o.VehicleLicensePlate != null)
                .Select(o => new { LeaseId = o.LeaseId!.Value, Plate = o.VehicleLicensePlate! })
                .ToList();
            var matchingLeaseIds = vehicleLeaseIds
                .Concat(occupantLeaseIds)
                .Where(x => LicensePlateNormalizer.Normalize(x.Plate).Contains(plateQuery, StringComparison.Ordinal))
                .Select(x => x.LeaseId)
                .ToHashSet();
            leases = leases.Where(l => matchingLeaseIds.Contains(l.Id)).ToList();
        }

        var items = leases.Select(l => MapLeaseItemDto(l, unmaskPii)).ToList();
        return Result<LeaseListResponse>.Success(new LeaseListResponse(items));
    }

    public Result<LeaseItemDto> GetAdminLease(Guid propertyId, Guid leaseId, bool unmaskPii = false)
    {
        var lease = _dbContext.Leases
            .AsNoTracking()
            .FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
        return lease is null
            ? Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId))
            : Result<LeaseItemDto>.Success(MapLeaseItemDto(lease, unmaskPii));
    }

    public Result<LeaseItemDto> CreateAdminLease(
        Guid propertyId,
        CreateLeaseRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (LeaseRequestValidation.ValidateCreate(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        using var tx = BeginTransactionIfNeeded();

        var unit = _dbContext.Units
            .FirstOrDefault(u => u.Id == request.UnitId && u.PropertyId == propertyId);
        if (unit is null)
        {
            return Result<LeaseItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unit '{request.UnitId}' does not belong to property '{propertyId}'."));
        }

        LockUnitRow(unit.Id);
        _dbContext.Entry(unit).Reload();

        if (!unit.SupportedStayModes.Contains(StayMode.Monthly))
        {
            return Result<LeaseItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unit {unit.UnitNumber} does not support Monthly StayMode."));
        }

        if (unit.OccupancyStatus != OccupancyStatus.Vacant)
        {
            return Result<LeaseItemDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Unit {unit.UnitNumber} is already {unit.OccupancyStatus}."));
        }

        var customer = _dbContext.Customers.AsNoTracking().FirstOrDefault(c => c.Id == request.CustomerId);
        if (customer is null)
        {
            return Result<LeaseItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Customer '{request.CustomerId}' was not found."));
        }

        if (FindActiveVehiclePlateConflict(propertyId, request.Vehicles ?? []) is { } plateError)
        {
            return Result<LeaseItemDto>.Failure(plateError);
        }

        try
        {
            EnsureLeaseWindowAvailable(unit, request.StartDate, request.EndDate, clockUtc);

            var property = _dbContext.Properties
                .AsNoTracking()
                .First(p => p.Id == propertyId);
            var lease = new Lease
            {
                PropertyId = propertyId,
                DocumentNumber = _documentNumberService.NextDocumentNumberAsync(
                    property.Id,
                    property.Code,
                    DocumentTypeCode.LSE,
                    clockUtc).GetAwaiter().GetResult(),
                UnitId = unit.Id,
                CustomerId = customer.Id,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                MonthlyRentAmount = decimal.Round(request.MonthlyRentAmount, 2, MidpointRounding.AwayFromZero),
                SecurityDepositAmount = decimal.Round(request.SecurityDepositAmount, 2, MidpointRounding.AwayFromZero),
                InitialWaterMeterReading = request.InitialWaterMeterReading,
                InitialElectricMeterReading = request.InitialElectricMeterReading
            };
            lease.Activate();
            unit.MarkOccupied();
            _dbContext.Leases.Add(lease);

            if (lease.SecurityDepositAmount > 0m)
            {
                var ledger = new DepositLedger
                {
                    PropertyId = propertyId,
                    CustomerId = customer.Id,
                    LeaseId = lease.Id,
                    DepositType = DepositType.LeaseSecurityDeposit
                };
                var depDocNo = _documentNumberService.NextDocumentNumberAsync(
                    property.Id,
                    property.Code,
                    DocumentTypeCode.DEP,
                    clockUtc).GetAwaiter().GetResult();
                ledger.RecordReceipt(depDocNo, lease.SecurityDepositAmount);
                _dbContext.DepositLedgers.Add(ledger);
                _dbContext.DepositTransactions.AddRange(ledger.Transactions);
            }

            var occupantRequests = request.Occupants is { Count: > 0 }
                ? request.Occupants
                : [LeaseRecordMapper.PrimaryOccupantFromCustomer(customer)];
            _dbContext.Occupants.AddRange(occupantRequests.Select(o => LeaseRecordMapper.BuildLeaseOccupant(lease, o)));
            _dbContext.TenantVehicles.AddRange((request.Vehicles ?? []).Select(v => LeaseRecordMapper.BuildTenantVehicle(lease, v)));

            _dbContext.SaveChanges();
            tx?.Commit();

            return Result<LeaseItemDto>.Success(MapLeaseItemDto(lease, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<LeaseItemDto> AddAdminLeaseOccupant(
        Guid propertyId,
        Guid leaseId,
        LeaseOccupantRequest request)
    {
        if (LeaseRequestValidation.ValidateOccupant(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        if (FindBlockingLease(propertyId, leaseId, out var lease) is { } leaseError)
        {
            return Result<LeaseItemDto>.Failure(leaseError);
        }

        _dbContext.Occupants.Add(LeaseRecordMapper.BuildLeaseOccupant(lease!, request));
        _dbContext.SaveChanges();
        return Result<LeaseItemDto>.Success(MapLeaseItemDto(lease!, unmaskPii: false));
    }

    public Result<LeaseItemDto> AddAdminLeaseVehicle(
        Guid propertyId,
        Guid leaseId,
        LeaseVehicleRequest request)
    {
        if (LeaseRequestValidation.ValidateVehicle(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        if (FindBlockingLease(propertyId, leaseId, out var lease) is { } leaseError)
        {
            return Result<LeaseItemDto>.Failure(leaseError);
        }

        if (FindActiveVehiclePlateConflict(propertyId, [request]) is { } plateError)
        {
            return Result<LeaseItemDto>.Failure(plateError);
        }

        _dbContext.TenantVehicles.Add(LeaseRecordMapper.BuildTenantVehicle(lease!, request));
        _dbContext.SaveChanges();
        return Result<LeaseItemDto>.Success(MapLeaseItemDto(lease!, unmaskPii: false));
    }

    public Result<LeaseItemDto> RenewAdminLease(
        Guid propertyId,
        Guid leaseId,
        RenewLeaseRequest request,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        using var tx = BeginTransactionIfNeeded();

        var lease = _dbContext.Leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
        if (lease is null)
        {
            return Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
        }

        try
        {
            if (request.NewEndDate > lease.EndDate)
            {
                LockUnitRow(lease.UnitId);
                var unit = _dbContext.Units.AsNoTracking().First(u => u.Id == lease.UnitId);
                // Extension window starts the day after the current EndDate, so it never overlaps the lease itself.
                EnsureLeaseWindowAvailable(unit, lease.EndDate.AddDays(1), request.NewEndDate, clockUtc);
            }

            lease.Renew(request.NewEndDate, request.NewMonthlyRentAmount);
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<LeaseItemDto>.Success(MapLeaseItemDto(lease, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<LeaseItemDto> GiveAdminLeaseMoveOutNotice(Guid propertyId, Guid leaseId)
    {
        var lease = _dbContext.Leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
        if (lease is null)
        {
            return Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
        }

        try
        {
            lease.GiveMoveOutNotice();
            _dbContext.SaveChanges();
            return Result<LeaseItemDto>.Success(MapLeaseItemDto(lease, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<LeaseSettlementDto> SettleAdminLeaseMoveOut(
        Guid propertyId,
        Guid leaseId,
        SettleLeaseMoveOutRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (LeaseRequestValidation.ValidateSettle(request) is { } validationError)
        {
            return Result<LeaseSettlementDto>.Failure(validationError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        using var tx = BeginTransactionIfNeeded();

        var lease = _dbContext.Leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
        if (lease is null)
        {
            return Result<LeaseSettlementDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
        }

        // Serialize concurrent settlements on the unit row, then re-read status so a double submit cannot refund twice.
        LockUnitRow(lease.UnitId);
        _dbContext.Entry(lease).Reload();

        if (lease.Status != LeaseStatus.MoveOutNotice)
        {
            return Result<LeaseSettlementDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Lease {lease.DocumentNumber} must be in MoveOutNotice to settle move-out (current: {lease.Status})."));
        }

        var ledger = _dbContext.DepositLedgers
            .Include(l => l.Transactions)
            .FirstOrDefault(l => l.LeaseId == lease.Id && l.DepositType == DepositType.LeaseSecurityDeposit);
        var totalDeduction = decimal.Round(
            request.UtilityDeductionAmount + request.DamageDeductionAmount, 2, MidpointRounding.AwayFromZero);
        var balance = ledger?.CurrentBalance ?? 0m;
        if (totalDeduction > balance)
        {
            return Result<LeaseSettlementDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Total deduction ({totalDeduction:0.00}) cannot exceed security deposit balance ({balance:0.00})."));
        }

        try
        {
            var refunded = 0m;
            if (ledger is not null)
            {
                var existingTxIds = ledger.Transactions.Select(t => t.Id).ToHashSet();
                var property = _dbContext.Properties
                    .AsNoTracking()
                    .First(p => p.Id == propertyId);
                var reason = request.Reason.Trim();

                if (totalDeduction > 0m)
                {
                    ledger.RecordDeduction(
                        _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                        totalDeduction,
                        reason);
                }

                if (ledger.CurrentBalance > 0m)
                {
                    refunded = ledger.RefundRemainingBalance(
                        _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                        reason).Amount;
                }

                _dbContext.DepositTransactions.AddRange(ledger.Transactions.Where(t => !existingTxIds.Contains(t.Id)));
            }

            lease.CompleteMoveOut();
            var unit = _dbContext.Units.First(u => u.Id == lease.UnitId);
            var housekeepingTask = unit.MarkCheckedOutOrMovedOut(lease.DocumentNumber);
            _dbContext.HousekeepingTasks.Add(housekeepingTask);

            _dbContext.SaveChanges();
            tx?.Commit();

            return Result<LeaseSettlementDto>.Success(new LeaseSettlementDto(
                Lease: MapLeaseItemDto(lease, unmaskPii: false),
                DeductedAmount: totalDeduction,
                RefundedAmount: refunded,
                GeneratedHousekeepingTaskStatus: housekeepingTask.Status.ToString()));
        }
        catch (DomainRuleException ex)
        {
            return Result<LeaseSettlementDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private void EnsureLeaseWindowAvailable(Unit unit, DateOnly startDate, DateOnly endDateInclusive, DateTimeOffset clockUtc)
    {
        ExpireStaleHolds(unit.PropertyId, clockUtc);
        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .First(ut => ut.Id == unit.UnitTypeId);
        var availability = EvaluateUnitTypeAvailabilityFromDb(
            unit.PropertyId,
            unitType,
            StayMode.Monthly,
            new DateTimeOffset(startDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
            new DateTimeOffset(endDateInclusive.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
            clockUtc,
            FindActiveRatePlan(unit.PropertyId, unitType.Id)?.TurnaroundBufferMinutes ?? 30);
        UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(unit.Id, availability);
    }

    private Error? FindBlockingLease(Guid propertyId, Guid leaseId, out Lease? lease)
    {
        lease = _dbContext.Leases
            .AsNoTracking()
            .FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
        if (lease is null)
        {
            return LeaseRecordMapper.LeaseNotFound(propertyId, leaseId);
        }

        return lease.BlocksUnitAvailability
            ? null
            : new Error(
                DomainErrorCodes.ValidationFailed,
                $"Lease {lease.DocumentNumber} must be Active or MoveOutNotice (current: {lease.Status}).");
    }

    private Error? FindActiveVehiclePlateConflict(Guid propertyId, IReadOnlyList<LeaseVehicleRequest> vehicles)
    {
        if (vehicles.Count == 0)
        {
            return null;
        }

        var activeLeaseIds = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId
                        && (l.Status == LeaseStatus.Active || l.Status == LeaseStatus.MoveOutNotice))
            .Select(l => l.Id)
            .ToList();
        var registeredPlates = _dbContext.TenantVehicles
            .AsNoTracking()
            .Where(v => activeLeaseIds.Contains(v.LeaseId))
            .Select(v => v.LicensePlate)
            .ToList()
            .Select(LicensePlateNormalizer.Normalize)
            .ToHashSet();
        var conflict = vehicles.FirstOrDefault(v => registeredPlates.Contains(LicensePlateNormalizer.Normalize(v.LicensePlate)));
        return conflict is null
            ? null
            : new Error(
                DomainErrorCodes.ValidationFailed,
                $"LicensePlate '{conflict.LicensePlate}' is already registered on another active lease in this property.");
    }

    private LeaseItemDto MapLeaseItemDto(Lease lease, bool unmaskPii)
    {
        var customer = _dbContext.Customers
            .AsNoTracking()
            .First(c => c.Id == lease.CustomerId);
        var unit = _dbContext.Units
            .AsNoTracking()
            .First(u => u.Id == lease.UnitId);
        var ledger = _dbContext.DepositLedgers
            .AsNoTracking()
            .Include(l => l.Transactions)
            .FirstOrDefault(l => l.LeaseId == lease.Id && l.DepositType == DepositType.LeaseSecurityDeposit);

        return new LeaseItemDto(
            Id: lease.Id,
            DocumentNumber: lease.DocumentNumber,
            Status: lease.Status.ToString(),
            Unit: BuildSingleUnitRef(unit),
            Customer: new CustomerRefDto(
                customer.Id,
                customer.FullName,
                unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
            StartDate: lease.StartDate,
            EndDate: lease.EndDate,
            MonthlyRentAmount: lease.MonthlyRentAmount,
            SecurityDepositAmount: lease.SecurityDepositAmount,
            SecurityDepositBalance: ledger?.CurrentBalance ?? 0m,
            InitialWaterMeterReading: lease.InitialWaterMeterReading,
            InitialElectricMeterReading: lease.InitialElectricMeterReading,
            Occupants: _dbContext.Occupants
                .AsNoTracking()
                .Where(o => o.LeaseId == lease.Id)
                .OrderByDescending(o => o.IsPrimaryOccupant)
                .ToList()
                .Select(o => LeaseRecordMapper.MapLeaseOccupant(o, unmaskPii))
                .ToList(),
            Vehicles: _dbContext.TenantVehicles
                .AsNoTracking()
                .Where(v => v.LeaseId == lease.Id)
                .ToList()
                .Select(LeaseRecordMapper.MapLeaseVehicle)
                .ToList());
    }
}
