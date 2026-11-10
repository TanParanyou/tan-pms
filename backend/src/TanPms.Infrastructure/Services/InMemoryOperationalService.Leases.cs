using TanPms.Application.Common.Models;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Leases;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Leases;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<TenantVehicle> _tenantVehicles = [];

    public Result<LeaseListResponse> GetAdminLeases(
        Guid propertyId,
        string? status,
        string? licensePlate,
        bool unmaskPii = false,
        PageRequest? paging = null)
    {
        if (LeaseRequestValidation.ParseStatusFilter(status, out var statusFilter) is { } statusError)
        {
            return Result<LeaseListResponse>.Failure(statusError);
        }

        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<LeaseListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Property '{propertyId}' was not found."));
            }

            var leases = _leases
                .Where(l => l.PropertyId == propertyId && (!statusFilter.HasValue || l.Status == statusFilter.Value));

            var plateQuery = LicensePlateNormalizer.Normalize(licensePlate);
            if (plateQuery.Length > 0)
            {
                var matchingLeaseIds = _tenantVehicles
                    .Where(v => v.PropertyId == propertyId)
                    .Where(v => LicensePlateNormalizer.Normalize(v.LicensePlate).Contains(plateQuery, StringComparison.Ordinal))
                    .Select(v => v.LeaseId)
                    .Concat(_occupants
                        .Where(o => o.PropertyId == propertyId && o.LeaseId.HasValue)
                        .Where(o => LicensePlateNormalizer.Normalize(o.VehicleLicensePlate).Contains(plateQuery, StringComparison.Ordinal))
                        .Select(o => o.LeaseId!.Value))
                    .ToHashSet();
                leases = leases.Where(l => matchingLeaseIds.Contains(l.Id));
            }

            var (page, pagination) = leases
                .OrderByDescending(l => l.StartDate)
                .ThenByDescending(l => l.DocumentNumber)
                .AsQueryable()
                .ToPage(paging);

            return Result<LeaseListResponse>.Success(new LeaseListResponse(page.Select(l => MapLeaseItemLocked(l, unmaskPii)).ToList(), pagination));
        }
    }

    public Result<LeaseItemDto> GetAdminLease(Guid propertyId, Guid leaseId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            return lease is null
                ? Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId))
                : Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease, unmaskPii));
        }
    }

    public Result<LeaseContractDto> GetAdminLeaseContract(Guid propertyId, Guid leaseId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            return lease is null
                ? Result<LeaseContractDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId))
                : Result<LeaseContractDto>.Success(new LeaseContractDto(
                    ReceiptRecordMapper.MapLetterhead(_properties[propertyId]),
                    MapLeaseItemLocked(lease, unmaskPii)));
        }
    }

    public Result<LeaseItemDto> CreateAdminLease(
        Guid propertyId,
        CreateLeaseRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null)
    {
        if (LeaseRequestValidation.ValidateCreate(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        lock (_syncRoot)
        {
            if (!_units.TryGetValue(request.UnitId, out var unit) || unit.PropertyId != propertyId)
            {
                return Result<LeaseItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Unit '{request.UnitId}' does not belong to property '{propertyId}'."));
            }

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

            if (!_customers.TryGetValue(request.CustomerId, out var customer))
            {
                return Result<LeaseItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Customer '{request.CustomerId}' was not found."));
            }

            if (FindActiveVehiclePlateConflictLocked(propertyId, request.Vehicles ?? []) is { } plateError)
            {
                return Result<LeaseItemDto>.Failure(plateError);
            }

            try
            {
                EnsureLeaseWindowAvailableLocked(unit, request.StartDate, request.EndDate, clockUtc);

                var property = _properties[propertyId];
                var lease = new Lease
                {
                    PropertyId = propertyId,
                    DocumentNumber = NextDocumentNumberAsync(
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
                _leases.Add(lease);

                if (lease.SecurityDepositAmount > 0m)
                {
                    var ledger = new DepositLedger
                    {
                        PropertyId = propertyId,
                        CustomerId = customer.Id,
                        LeaseId = lease.Id,
                        DepositType = DepositType.LeaseSecurityDeposit
                    };
                    var depDocNo = NextDocumentNumberAsync(
                        property.Id,
                        property.Code,
                        DocumentTypeCode.DEP,
                        clockUtc).GetAwaiter().GetResult();
                    var depositMethod = request.PaymentMethod ?? PaymentMethods.Cash;
                ledger.RecordReceipt(
                    depDocNo,
                    lease.SecurityDepositAmount,
                    depositMethod == PaymentMethods.Cash ? FindOpenShiftForCashLocked(propertyId, cashierUserId) : null,
                    depositMethod);
                    _depositLedgers.Add(ledger);
                }

                var occupants = request.Occupants is { Count: > 0 }
                    ? request.Occupants.Select(o => LeaseRecordMapper.BuildLeaseOccupant(lease, o))
                    : [LeaseRecordMapper.BuildLeaseOccupant(lease, LeaseRecordMapper.PrimaryOccupantFromCustomer(customer))];
                _occupants.AddRange(occupants);
                _tenantVehicles.AddRange((request.Vehicles ?? []).Select(v => LeaseRecordMapper.BuildTenantVehicle(lease, v)));

                return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
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

        lock (_syncRoot)
        {
            if (FindBlockingLeaseLocked(propertyId, leaseId, out var lease) is { } leaseError)
            {
                return Result<LeaseItemDto>.Failure(leaseError);
            }

            _occupants.Add(LeaseRecordMapper.BuildLeaseOccupant(lease!, request));
            return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease!, unmaskPii: false));
        }
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

        lock (_syncRoot)
        {
            if (FindBlockingLeaseLocked(propertyId, leaseId, out var lease) is { } leaseError)
            {
                return Result<LeaseItemDto>.Failure(leaseError);
            }

            if (FindActiveVehiclePlateConflictLocked(propertyId, [request]) is { } plateError)
            {
                return Result<LeaseItemDto>.Failure(plateError);
            }

            _tenantVehicles.Add(LeaseRecordMapper.BuildTenantVehicle(lease!, request));
            return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease!, unmaskPii: false));
        }
    }

    public Result<LeaseItemDto> UpdateAdminLease(Guid propertyId, Guid leaseId, UpdateLeaseRequest request)
    {
        if (LeaseRequestValidation.ValidateUpdate(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            if (lease is null)
            {
                return Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
            }

            var startPeriod = LeaseRecordMapper.LeaseStartPeriod(lease);
            if ((request.InitialWaterMeterReading.HasValue || request.InitialElectricMeterReading.HasValue)
                && _meterReadings.Any(r => r.UnitId == lease.UnitId && string.CompareOrdinal(r.BillingPeriodYearMonth, startPeriod) >= 0))
            {
                return Result<LeaseItemDto>.Failure(LeaseRequestValidation.InitialReadingsLocked(lease.DocumentNumber));
            }

            try
            {
                lease.UpdateTerms(request.MonthlyRentAmount, request.InitialWaterMeterReading, request.InitialElectricMeterReading);
                Touch(lease);
                return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<LeaseItemDto> UpdateAdminLeaseOccupant(
        Guid propertyId,
        Guid leaseId,
        Guid occupantId,
        UpdateLeaseOccupantRequest request)
    {
        if (LeaseRequestValidation.ValidateOccupantUpdate(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            if (FindBlockingLeaseLocked(propertyId, leaseId, out var lease) is { } leaseError)
            {
                return Result<LeaseItemDto>.Failure(leaseError);
            }

            var occupants = _occupants.Where(o => o.LeaseId == leaseId).ToList();
            return LeaseRecordMapper.ApplyOccupantUpdate(occupants, occupantId, request) is { } updateError
                ? Result<LeaseItemDto>.Failure(updateError)
                : Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease!, unmaskPii: false));
        }
    }

    public Result<LeaseItemDto> DeleteAdminLeaseOccupant(Guid propertyId, Guid leaseId, Guid occupantId)
    {
        lock (_syncRoot)
        {
            if (FindBlockingLeaseLocked(propertyId, leaseId, out var lease) is { } leaseError)
            {
                return Result<LeaseItemDto>.Failure(leaseError);
            }

            var occupants = _occupants.Where(o => o.LeaseId == leaseId).ToList();
            if (LeaseRecordMapper.CheckOccupantDelete(occupants, occupantId, out var occupant) is { } deleteError)
            {
                return Result<LeaseItemDto>.Failure(deleteError);
            }

            _occupants.Remove(occupant!);
            return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease!, unmaskPii: false));
        }
    }

    public Result<LeaseItemDto> UpdateAdminLeaseVehicle(
        Guid propertyId,
        Guid leaseId,
        Guid vehicleId,
        LeaseVehicleRequest request)
    {
        if (LeaseRequestValidation.ValidateVehicle(request) is { } validationError)
        {
            return Result<LeaseItemDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            if (FindBlockingLeaseLocked(propertyId, leaseId, out var lease) is { } leaseError)
            {
                return Result<LeaseItemDto>.Failure(leaseError);
            }

            var vehicle = _tenantVehicles.FirstOrDefault(v => v.Id == vehicleId && v.LeaseId == leaseId);
            if (vehicle is null)
            {
                return Result<LeaseItemDto>.Failure(LeaseRequestValidation.VehicleNotFound(vehicleId));
            }

            if (LicensePlateNormalizer.Normalize(vehicle.LicensePlate) != LicensePlateNormalizer.Normalize(request.LicensePlate)
                && FindActiveVehiclePlateConflictLocked(propertyId, [request]) is { } plateError)
            {
                return Result<LeaseItemDto>.Failure(plateError);
            }

            LeaseRecordMapper.ApplyVehicleUpdate(vehicle, request);
            return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease!, unmaskPii: false));
        }
    }

    public Result<LeaseItemDto> DeleteAdminLeaseVehicle(Guid propertyId, Guid leaseId, Guid vehicleId)
    {
        lock (_syncRoot)
        {
            if (FindBlockingLeaseLocked(propertyId, leaseId, out var lease) is { } leaseError)
            {
                return Result<LeaseItemDto>.Failure(leaseError);
            }

            return _tenantVehicles.RemoveAll(v => v.Id == vehicleId && v.LeaseId == leaseId) == 0
                ? Result<LeaseItemDto>.Failure(LeaseRequestValidation.VehicleNotFound(vehicleId))
                : Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease!, unmaskPii: false));
        }
    }

    public Result<LeaseSettlementDto> CancelAdminLease(
        Guid propertyId,
        Guid leaseId,
        CancelLeaseRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<LeaseSettlementDto>.Failure(reasonError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            if (lease is null)
            {
                return Result<LeaseSettlementDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
            }

            var invoices = _invoices.Where(i => i.LeaseId == lease.Id).ToList();
            if (invoices.Any(i => i.Status is not (InvoiceStatus.Draft or InvoiceStatus.Voided)))
            {
                return Result<LeaseSettlementDto>.Failure(LeaseRequestValidation.CancelBlockedByBilling(lease.DocumentNumber));
            }

            try
            {
                lease.Cancel(request.Reason);
                Touch(lease, clockUtc);
                var refunded = 0m;
                var ledger = _depositLedgers.FirstOrDefault(l =>
                    l.LeaseId == lease.Id && l.DepositType == DepositType.LeaseSecurityDeposit);
                if (ledger is { CurrentBalance: > 0m })
                {
                    var property = _properties[propertyId];
                    refunded = ledger.RefundRemainingBalance(
                        NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                        request.Reason.Trim(),
                        RefundShiftLocked(request.RefundPaymentMethod, propertyId, cashierUserId),
                        request.RefundPaymentMethod ?? PaymentMethods.Cash).Amount;
                }

                _invoices.RemoveAll(i => i.LeaseId == lease.Id && i.Status == InvoiceStatus.Draft);
                var housekeepingTask = _units[lease.UnitId].MarkCheckedOutOrMovedOut(lease.DocumentNumber);
                _housekeepingTasks.Add(housekeepingTask);

                return Result<LeaseSettlementDto>.Success(new LeaseSettlementDto(
                    Lease: MapLeaseItemLocked(lease, unmaskPii: false),
                    DeductedAmount: 0m,
                    RefundedAmount: refunded,
                    GeneratedHousekeepingTaskStatus: housekeepingTask.Status.ToString()));
            }
            catch (DomainRuleException ex)
            {
                return Result<LeaseSettlementDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<LeaseItemDto> RenewAdminLease(
        Guid propertyId,
        Guid leaseId,
        RenewLeaseRequest request,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            if (lease is null)
            {
                return Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
            }

            try
            {
                if (request.NewEndDate > lease.EndDate)
                {
                    // Extension window starts the day after the current EndDate, so it never overlaps the lease itself.
                    EnsureLeaseWindowAvailableLocked(_units[lease.UnitId], lease.EndDate.AddDays(1), request.NewEndDate, clockUtc);
                }

                lease.Renew(request.NewEndDate, request.NewMonthlyRentAmount);
                Touch(lease);
                return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<LeaseItemDto> GiveAdminLeaseMoveOutNotice(Guid propertyId, Guid leaseId)
    {
        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            if (lease is null)
            {
                return Result<LeaseItemDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
            }

            try
            {
                lease.GiveMoveOutNotice();
                Touch(lease);
                return Result<LeaseItemDto>.Success(MapLeaseItemLocked(lease, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<LeaseItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<LeaseSettlementDto> SettleAdminLeaseMoveOut(
        Guid propertyId,
        Guid leaseId,
        SettleLeaseMoveOutRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null)
    {
        if (LeaseRequestValidation.ValidateSettle(request) is { } validationError)
        {
            return Result<LeaseSettlementDto>.Failure(validationError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        lock (_syncRoot)
        {
            var lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
            if (lease is null)
            {
                return Result<LeaseSettlementDto>.Failure(LeaseRecordMapper.LeaseNotFound(propertyId, leaseId));
            }

            if (lease.Status != LeaseStatus.MoveOutNotice)
            {
                return Result<LeaseSettlementDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Lease {lease.DocumentNumber} must be in MoveOutNotice to settle move-out (current: {lease.Status})."));
            }

            var ledger = _depositLedgers.FirstOrDefault(l =>
                l.LeaseId == lease.Id && l.DepositType == DepositType.LeaseSecurityDeposit);
            var totalDeduction = decimal.Round(
                request.UtilityDeductionAmount + request.DamageDeductionAmount, 2, MidpointRounding.AwayFromZero);
            var balance = ledger?.CurrentBalance ?? 0m;
            if (totalDeduction > balance)
            {
                return Result<LeaseSettlementDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Total deduction ({totalDeduction:0.00}) cannot exceed security deposit balance ({balance:0.00})."));
            }

            var property = _properties[propertyId];
            var reason = request.Reason.Trim();
            var refunded = 0m;
            if (ledger is not null)
            {
                if (totalDeduction > 0m)
                {
                    ledger.RecordDeduction(
                        NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                        totalDeduction,
                        reason);
                }

                if (ledger.CurrentBalance > 0m)
                {
                    refunded = ledger.RefundRemainingBalance(
                        NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                        reason,
                        RefundShiftLocked(request.RefundPaymentMethod, propertyId, cashierUserId),
                        request.RefundPaymentMethod ?? PaymentMethods.Cash).Amount;
                }
            }

            lease.CompleteMoveOut();
            Touch(lease, clockUtc);
            var housekeepingTask = _units[lease.UnitId].MarkCheckedOutOrMovedOut(lease.DocumentNumber);
            _housekeepingTasks.Add(housekeepingTask);

            return Result<LeaseSettlementDto>.Success(new LeaseSettlementDto(
                Lease: MapLeaseItemLocked(lease, unmaskPii: false),
                DeductedAmount: totalDeduction,
                RefundedAmount: refunded,
                GeneratedHousekeepingTaskStatus: housekeepingTask.Status.ToString()));
        }
    }

    private Domain.Cashier.CashierShift? RefundShiftLocked(string? paymentMethod, Guid propertyId, string? cashierUserId) =>
        (paymentMethod ?? PaymentMethods.Cash) == PaymentMethods.Cash ? FindOpenShiftForCashLocked(propertyId, cashierUserId) : null;

    private void EnsureLeaseWindowAvailableLocked(Unit unit, DateOnly startDate, DateOnly endDateInclusive, DateTimeOffset clockUtc)
    {
        ExpireStaleHoldsLocked(clockUtc);
        var unitType = _unitTypes[unit.UnitTypeId];
        var availability = UnifiedAvailabilityCalculator.EvaluateUnitTypeAvailability(
            unitType: unitType,
            unitsOfUnitType: _units.Values.Where(u => u.PropertyId == unit.PropertyId && u.UnitTypeId == unitType.Id),
            propertyLeases: _leases,
            propertyStays: _stays,
            propertyReservations: _reservations,
            requestedStayMode: StayMode.Monthly,
            slotStartAt: new DateTimeOffset(startDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
            slotEndAt: new DateTimeOffset(endDateInclusive.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
            nowUtc: clockUtc,
            turnaroundBufferMinutes: FindActiveRatePlanLocked(unit.PropertyId, unitType.Id)?.TurnaroundBufferMinutes ?? 30);
        UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(unit.Id, availability);
    }

    private Error? FindBlockingLeaseLocked(Guid propertyId, Guid leaseId, out Lease? lease)
    {
        lease = _leases.FirstOrDefault(l => l.Id == leaseId && l.PropertyId == propertyId);
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

    private Error? FindActiveVehiclePlateConflictLocked(Guid propertyId, IReadOnlyList<LeaseVehicleRequest> vehicles)
    {
        var activeLeaseIds = _leases
            .Where(l => l.PropertyId == propertyId && l.BlocksUnitAvailability)
            .Select(l => l.Id)
            .ToHashSet();
        var registeredPlates = _tenantVehicles
            .Where(v => activeLeaseIds.Contains(v.LeaseId))
            .Select(v => LicensePlateNormalizer.Normalize(v.LicensePlate))
            .ToHashSet();
        var conflict = vehicles.FirstOrDefault(v => registeredPlates.Contains(LicensePlateNormalizer.Normalize(v.LicensePlate)));
        return conflict is null
            ? null
            : new Error(
                DomainErrorCodes.ValidationFailed,
                $"LicensePlate '{conflict.LicensePlate}' is already registered on another active lease in this property.");
    }

    private LeaseItemDto MapLeaseItemLocked(Lease lease, bool unmaskPii)
    {
        var customer = _customers[lease.CustomerId];
        var ledger = _depositLedgers.FirstOrDefault(l =>
            l.LeaseId == lease.Id && l.DepositType == DepositType.LeaseSecurityDeposit);

        return new LeaseItemDto(
            Id: lease.Id,
            DocumentNumber: lease.DocumentNumber,
            Status: lease.Status.ToString(),
            Unit: _unitRefs[lease.UnitId],
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
            Occupants: _occupants
                .Where(o => o.LeaseId == lease.Id)
                .Select(o => LeaseRecordMapper.MapLeaseOccupant(o, unmaskPii))
                .ToList(),
            Vehicles: _tenantVehicles
                .Where(v => v.LeaseId == lease.Id)
                .Select(LeaseRecordMapper.MapLeaseVehicle)
                .ToList(),
            CancelReason: lease.CancelReason);
    }
}
