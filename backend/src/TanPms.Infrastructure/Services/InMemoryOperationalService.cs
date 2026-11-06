using System.Collections.Concurrent;
using TanPms.Application.Abstractions;
using TanPms.Application.Contracts;
using TanPms.Domain.Common;
using TanPms.Domain.Entities;
using TanPms.Domain.Enums;
using TanPms.Domain.Exceptions;
using TanPms.Domain.Services;

namespace TanPms.Infrastructure.Services;

public static class PmsSeedConstants
{
    public static readonly Guid BkkPropertyId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid CnxPropertyId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public static readonly Guid BkkBuildingAId = Guid.Parse("11111111-aaaa-1111-1111-111111111111");
    public static readonly Guid BkkFloor1Id = Guid.Parse("11111111-f001-1111-1111-111111111111");
    public static readonly Guid BkkFloor2Id = Guid.Parse("11111111-f002-1111-1111-111111111111");
    public static readonly Guid StandardUnitTypeId = Guid.Parse("11111111-cccc-1111-1111-111111111101");
    public static readonly Guid DeluxeUnitTypeId = Guid.Parse("11111111-cccc-1111-1111-111111111102");

    public static readonly Guid CleanUnitA101Id = Guid.Parse("33333333-3333-3333-3333-333333333301");
    public static readonly Guid DirtyUnitA102Id = Guid.Parse("33333333-3333-3333-3333-333333333302");
    public static readonly Guid OccupiedMonthlyUnitA201Id = Guid.Parse("33333333-3333-3333-3333-333333333303");

    public static readonly Guid PrimaryCustomerId = Guid.Parse("44444444-4444-4444-4444-444444444401");
    public static readonly Guid SecondaryCustomerId = Guid.Parse("44444444-4444-4444-4444-444444444402");
}

public sealed class InMemoryOperationalService : IPmsOperationalService, IDocumentNumberService, IAuditLogger
{
    private readonly ConcurrentDictionary<string, int> _sequences = new();
    private readonly ConcurrentBag<AuditEvent> _auditEvents = [];
    private readonly Dictionary<Guid, Property> _properties = [];
    private readonly Dictionary<Guid, Unit> _units = [];
    private readonly Dictionary<Guid, UnitRefDto> _unitRefs = [];
    private readonly Dictionary<Guid, Customer> _customers = [];
    private readonly List<Invoice> _invoices = [];
    private readonly List<Parcel> _parcels = [];
    private readonly List<Lease> _leases = [];
    private readonly List<Reservation> _reservations = [];
    private readonly object _syncRoot = new();

    public InMemoryOperationalService()
    {
        Seed();
    }

    public IReadOnlyCollection<AuditEvent> AuditEvents => _auditEvents.ToArray();

    public Task<string> NextDocumentNumberAsync(
        Guid propertyId,
        string propertyCode,
        DocumentTypeCode documentType,
        DateTimeOffset issuedAtUtc,
        CancellationToken cancellationToken = default)
    {
        var key = $"{propertyId}:{documentType}:{issuedAtUtc.Year:0000}{issuedAtUtc.Month:00}";
        var next = _sequences.AddOrUpdate(key, 1, (_, current) => current + 1);
        var formatted = DocumentNumberFormatter.Format(
            propertyCode,
            documentType,
            issuedAtUtc.Year,
            issuedAtUtc.Month,
            next);
        return Task.FromResult(formatted);
    }

    public Task RecordAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        _auditEvents.Add(auditEvent);
        return Task.CompletedTask;
    }

    public RoomRackResponse GetRoomRack(Guid propertyId, ICurrentUserContext userContext)
    {
        userContext.EnsureAdminPropertyAccess(propertyId);

        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var property))
            {
                throw new DomainRuleException(
                    DomainErrorCodes.ValidationFailed,
                    $"Property '{propertyId}' was not found.",
                    httpStatus: 400);
            }

            var primaryCustomer = _customers[PmsSeedConstants.PrimaryCustomerId];
            var primaryCustomerDto = new CustomerRefDto(
                primaryCustomer.Id,
                primaryCustomer.FullName,
                primaryCustomer.GetMaskedIdentity());

            var items = _units.Values
                .Where(u => u.PropertyId == propertyId)
                .OrderBy(u => u.UnitNumber)
                .Select(u =>
                {
                    var unitRef = _unitRefs[u.Id];
                    var isOccupiedLease = u.Id == PmsSeedConstants.OccupiedMonthlyUnitA201Id;
                    return new RoomRackItemDto(
                        Unit: unitRef,
                        OccupancyStatus: u.OccupancyStatus.ToString(),
                        ConditionStatus: u.ConditionStatus.ToString(),
                        SupportedStayModes: u.SupportedStayModes.Select(m => m.ToString()).ToList(),
                        ActiveStayMode: isOccupiedLease ? StayMode.Monthly.ToString() : null,
                        ActiveDocumentNumber: isOccupiedLease ? "BKK01-LSE-2611-0001" : null,
                        Customer: isOccupiedLease ? primaryCustomerDto : null,
                        RemainingMinutes: null);
                })
                .ToList();

            return new RoomRackResponse(
                Property: new PropertyRefDto(property.Id, property.Code, property.Name),
                Items: items);
        }
    }

    public StaySummaryDto CheckInStay(CheckInStayRequest request, ICurrentUserContext userContext)
    {
        userContext.EnsureAdminPropertyAccess(request.PropertyId);

        if (!userContext.HasOpenCashierShift)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift in the property before performing check-in.");
        }

        if (!Enum.TryParse<StayMode>(request.StayMode, ignoreCase: true, out var stayMode)
            || stayMode == StayMode.Monthly)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "CheckInStay only supports Hourly or Daily StayMode.",
                httpStatus: 400);
        }

        lock (_syncRoot)
        {
            if (!_units.TryGetValue(request.UnitId, out var unit) || unit.PropertyId != request.PropertyId)
            {
                throw new DomainRuleException(
                    DomainErrorCodes.ValidationFailed,
                    $"Unit '{request.UnitId}' does not belong to property '{request.PropertyId}'.",
                    httpStatus: 400);
            }

            if (unit.OccupancyStatus != OccupancyStatus.Vacant)
            {
                throw new DomainRuleException(
                    DomainErrorCodes.ReservationSlotOverlap,
                    $"Unit {unit.UnitNumber} is already {unit.OccupancyStatus}.");
            }

            var hasOverridePerm = userContext.Permissions.Contains("admin.stay.override_dirty_checkin");
            unit.EnsureCanCheckIn(request.OverrideDirtyCheckIn, hasOverridePerm, request.OverrideReason);

            if (unit.ConditionStatus != ConditionStatus.Clean && request.OverrideDirtyCheckIn)
            {
                _auditEvents.Add(new AuditEvent
                {
                    PropertyId = request.PropertyId,
                    ActionKey = "admin.stay.override_dirty_checkin",
                    EntityId = unit.Id,
                    Reason = request.OverrideReason!,
                    BeforeStateJson = $"{{\"conditionStatus\":\"{unit.ConditionStatus}\"}}",
                    AfterStateJson = "{\"occupancyStatus\":\"Occupied\"}"
                });
            }

            var property = _properties[request.PropertyId];
            var docNo = NextDocumentNumberAsync(
                property.Id,
                property.Code,
                DocumentTypeCode.STY,
                DateTimeOffset.UtcNow).GetAwaiter().GetResult();

            if (!_customers.TryGetValue(request.CustomerId, out var customer))
            {
                customer = new Customer
                {
                    Id = request.CustomerId,
                    FullName = "Walk-in Guest",
                    NationalIdOrPassport = "1100501234123"
                };
                _customers[customer.Id] = customer;
            }

            var stay = new Stay
            {
                PropertyId = request.PropertyId,
                DocumentNumber = docNo,
                UnitId = unit.Id,
                CustomerId = customer.Id,
                StayMode = stayMode,
                CheckInAt = DateTimeOffset.UtcNow,
                KeyDepositAmount = request.KeyDepositAmount
            };

            return new StaySummaryDto(
                Id: stay.Id,
                DocumentNumber: stay.DocumentNumber,
                StayMode: stay.StayMode.ToString(),
                Status: stay.Status.ToString(),
                Unit: _unitRefs[unit.Id],
                Customer: new CustomerRefDto(
                    customer.Id,
                    customer.FullName,
                    customer.GetMaskedIdentity()));
        }
    }

    public ClientDashboardResponse GetClientDashboard(ICurrentUserContext userContext)
    {
        var customerId = userContext.RequireClientCustomerId();

        lock (_syncRoot)
        {
            if (!_customers.TryGetValue(customerId, out var customer))
            {
                customer = new Customer
                {
                    Id = customerId,
                    FullName = "Client Tenant",
                    NationalIdOrPassport = "1100509999123"
                };
            }

            var customerDto = new CustomerRefDto(
                customer.Id,
                customer.FullName,
                customer.GetMaskedIdentity());

            var hold = _reservations
                .Where(r => r.CustomerId == customerId && r.Status == ReservationStatus.Hold)
                .Select(r => new ClientHoldReservationDto(
                    r.DocumentNumber,
                    "Standard 24 sqm",
                    r.StayMode.ToString(),
                    r.HoldExpiresAt,
                    r.DepositAmount))
                .FirstOrDefault();

            var lease = _leases
                .Where(l => l.CustomerId == customerId && l.BlocksUnitAvailability)
                .Select(l => new ClientActiveLeaseDto(
                    l.DocumentNumber,
                    _unitRefs[l.UnitId],
                    l.MonthlyRentAmount,
                    l.SecurityDepositAmount))
                .FirstOrDefault();

            var unpaidInvoices = _invoices
                .Where(i => i.CustomerId == customerId && i.Status is InvoiceStatus.Issued or InvoiceStatus.Overdue or InvoiceStatus.PartiallyPaid)
                .Select(i => new ClientUnpaidInvoiceDto(
                    i.Id,
                    i.DocumentNumber,
                    i.TotalAmount,
                    i.Status.ToString()))
                .ToList();

            var pendingParcels = _parcels
                .Where(p => p.CustomerId == customerId && p.Status == ParcelStatus.Arrived)
                .Select(p => new ClientPendingParcelDto(
                    p.Id,
                    p.DocumentNumber,
                    p.CarrierName,
                    p.ArrivedAt))
                .ToList();

            return new ClientDashboardResponse(
                Customer: customerDto,
                ActiveHoldReservation: hold,
                ActiveLease: lease,
                UnpaidInvoices: unpaidInvoices,
                PendingParcels: pendingParcels);
        }
    }

    private void Seed()
    {
        var bkk = new Property
        {
            Id = PmsSeedConstants.BkkPropertyId,
            Code = "BKK01",
            Name = "TAN Residence Ratchada",
            TaxBranchCode = "00000"
        };
        var cnx = new Property
        {
            Id = PmsSeedConstants.CnxPropertyId,
            Code = "CNX01",
            Name = "TAN Suites Nimman",
            TaxBranchCode = "00001"
        };

        _properties[bkk.Id] = bkk;
        _properties[cnx.Id] = cnx;

        var unitA101 = new Unit
        {
            Id = PmsSeedConstants.CleanUnitA101Id,
            PropertyId = bkk.Id,
            BuildingId = PmsSeedConstants.BkkBuildingAId,
            FloorId = PmsSeedConstants.BkkFloor1Id,
            UnitTypeId = PmsSeedConstants.StandardUnitTypeId,
            UnitNumber = "A-101"
        };

        var unitA102 = new Unit
        {
            Id = PmsSeedConstants.DirtyUnitA102Id,
            PropertyId = bkk.Id,
            BuildingId = PmsSeedConstants.BkkBuildingAId,
            FloorId = PmsSeedConstants.BkkFloor1Id,
            UnitTypeId = PmsSeedConstants.StandardUnitTypeId,
            UnitNumber = "A-102"
        };
        unitA102.SetConditionStatus(ConditionStatus.Dirty);

        var unitA201 = new Unit
        {
            Id = PmsSeedConstants.OccupiedMonthlyUnitA201Id,
            PropertyId = bkk.Id,
            BuildingId = PmsSeedConstants.BkkBuildingAId,
            FloorId = PmsSeedConstants.BkkFloor2Id,
            UnitTypeId = PmsSeedConstants.DeluxeUnitTypeId,
            UnitNumber = "A-201"
        };
        unitA201.MarkOccupied();

        _units[unitA101.Id] = unitA101;
        _units[unitA102.Id] = unitA102;
        _units[unitA201.Id] = unitA201;

        _unitRefs[unitA101.Id] = new UnitRefDto(unitA101.Id, "A-101", "Building A", 1, "Standard 24 sqm");
        _unitRefs[unitA102.Id] = new UnitRefDto(unitA102.Id, "A-102", "Building A", 1, "Standard 24 sqm");
        _unitRefs[unitA201.Id] = new UnitRefDto(unitA201.Id, "A-201", "Building A", 2, "Deluxe 32 sqm");

        var customer1 = new Customer
        {
            Id = PmsSeedConstants.PrimaryCustomerId,
            FullName = "Somchai Rakdee",
            NationalIdOrPassport = "1100501234123"
        };

        var customer2 = new Customer
        {
            Id = PmsSeedConstants.SecondaryCustomerId,
            FullName = "Sudaawattana Jaidee",
            NationalIdOrPassport = "3100909876541"
        };

        _customers[customer1.Id] = customer1;
        _customers[customer2.Id] = customer2;

        var lease1 = new Lease
        {
            PropertyId = bkk.Id,
            DocumentNumber = "BKK01-LSE-2611-0001",
            UnitId = unitA201.Id,
            CustomerId = customer1.Id,
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 12, 31),
            MonthlyRentAmount = 8500.00m,
            SecurityDepositAmount = 17000.00m
        };
        lease1.Activate();
        _leases.Add(lease1);

        var invoice1 = new Invoice
        {
            PropertyId = bkk.Id,
            DocumentNumber = "BKK01-INV-2611-0001",
            CustomerId = customer1.Id,
            LeaseId = lease1.Id
        };
        invoice1.AddLine("Monthly Room Rent (Nov 2026)", 8500.00m, TaxMode.Exempt);
        invoice1.AddLine("Furniture Rental", 1000.00m, TaxMode.VatExcluded);
        invoice1.Issue();
        _invoices.Add(invoice1);

        var invoice2 = new Invoice
        {
            PropertyId = bkk.Id,
            DocumentNumber = "BKK01-INV-2611-0002",
            CustomerId = customer2.Id
        };
        invoice2.AddLine("Daily Stay Balance", 1200.00m, TaxMode.VatIncluded);
        invoice2.Issue();
        _invoices.Add(invoice2);

        _parcels.Add(new Parcel
        {
            PropertyId = bkk.Id,
            DocumentNumber = "BKK01-PCL-2611-0001",
            UnitId = unitA201.Id,
            CustomerId = customer1.Id,
            CarrierName = "Kerry Express",
            TrackingNumber = "KEX123456789TH"
        });
    }
}
