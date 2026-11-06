using System.Collections.Concurrent;
using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Application.Notifications;
using TanPms.Application.Rack;
using TanPms.Application.Stays;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Identity;
using TanPms.Domain.Leases;
using TanPms.Domain.Notifications;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

public sealed class InMemoryOperationalService
    : IPmsOperationalStore, IDocumentNumberService, IAuditLogger, INotificationSender
{
    private readonly ConcurrentDictionary<string, int> _sequences = new();
    private readonly ConcurrentBag<AuditEvent> _auditEvents = [];
    private readonly Dictionary<Guid, Property> _properties = [];
    private readonly Dictionary<Guid, Unit> _units = [];
    private readonly Dictionary<Guid, UnitRefDto> _unitRefs = [];
    private readonly Dictionary<Guid, Customer> _customers = [];
    private readonly List<RoleDefinitionDto> _roles = [];
    private readonly List<PermissionDefinitionDto> _permissions = [];
    private readonly List<AdminUser> _adminUsers = [];
    private readonly List<NotificationMessage> _notifications = [];
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

    public Task NotifyCustomerAsync(
        Guid customerId,
        string templateKey,
        IReadOnlyDictionary<string, string> parameters,
        CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Result<AuthSessionResponse> Login(LoginAuthSessionCommand command)
    {
        lock (_syncRoot)
        {
            var isClient = string.Equals(command.Scope, "client", StringComparison.OrdinalIgnoreCase);
            if (isClient)
            {
                var customer = _customers[PmsSeedConstants.PrimaryCustomerId];
                var customerRef = new CustomerRefDto(
                    customer.Id,
                    customer.FullName,
                    customer.GetMaskedIdentity());

                return Result<AuthSessionResponse>.Success(new AuthSessionResponse(
                    UserId: $"client-{customer.Id:N}",
                    Scope: "client",
                    DisplayName: customer.FullName,
                    RoleCode: RoleCodes.ClientCustomer,
                    RoleName: new LocalizedTextDto("ลูกค้า / ผู้เช่า", "Client / Tenant"),
                    AllowedProperties: [],
                    Permissions: [],
                    Customer: customerRef,
                    AccessToken: $"tok_client_{customer.Id:N}"));
            }

            var matchedUser = _adminUsers.FirstOrDefault(u =>
                    string.Equals(u.Username, command.Identifier, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(u.Email, command.Identifier, StringComparison.OrdinalIgnoreCase))
                ?? _adminUsers[0];

            var allowedProps = matchedUser.AllowedPropertyIds
                .Where(id => _properties.ContainsKey(id))
                .Select(id =>
                {
                    var prop = _properties[id];
                    return new PropertyRefDto(prop.Id, prop.Code, LocalizedTextDto.FromDomain(prop.Name));
                })
                .ToList();

            return Result<AuthSessionResponse>.Success(new AuthSessionResponse(
                UserId: matchedUser.Id.ToString(),
                Scope: "admin",
                DisplayName: matchedUser.FullName,
                RoleCode: matchedUser.RoleCode,
                RoleName: LocalizedTextDto.FromDomain(matchedUser.RoleName),
                AllowedProperties: allowedProps,
                Permissions: matchedUser.Permissions.ToList(),
                Customer: null,
                AccessToken: $"tok_admin_{matchedUser.Id:N}"));
        }
    }

    public Result<AuthSessionResponse> GetCurrentAuthSession(ICurrentUserContext currentUser)
    {
        lock (_syncRoot)
        {
            if (currentUser.IsClientScope)
            {
                var customerId = currentUser.CustomerId ?? PmsSeedConstants.PrimaryCustomerId;
                if (!_customers.TryGetValue(customerId, out var customer))
                {
                    customer = _customers[PmsSeedConstants.PrimaryCustomerId];
                }

                return Result<AuthSessionResponse>.Success(new AuthSessionResponse(
                    UserId: currentUser.UserId,
                    Scope: "client",
                    DisplayName: customer.FullName,
                    RoleCode: RoleCodes.ClientCustomer,
                    RoleName: new LocalizedTextDto("ลูกค้า / ผู้เช่า", "Client / Tenant"),
                    AllowedProperties: [],
                    Permissions: [],
                    Customer: new CustomerRefDto(customer.Id, customer.FullName, customer.GetMaskedIdentity()),
                    AccessToken: $"tok_client_{customer.Id:N}"));
            }

            var allowedProps = currentUser.AllowedPropertyIds
                .Where(id => _properties.ContainsKey(id))
                .Select(id =>
                {
                    var prop = _properties[id];
                    return new PropertyRefDto(prop.Id, prop.Code, LocalizedTextDto.FromDomain(prop.Name));
                })
                .ToList();

            return Result<AuthSessionResponse>.Success(new AuthSessionResponse(
                UserId: currentUser.UserId,
                Scope: "admin",
                DisplayName: "Admin Operator",
                RoleCode: RoleCodes.PropertyManager,
                RoleName: new LocalizedTextDto("ผู้จัดการสาขา", "Property Manager"),
                AllowedProperties: allowedProps,
                Permissions: currentUser.Permissions.ToList(),
                Customer: null,
                AccessToken: "tok_admin_session"));
        }
    }

    public Result<RoleCatalogResponse> GetRoleCatalog()
    {
        lock (_syncRoot)
        {
            return Result<RoleCatalogResponse>.Success(new RoleCatalogResponse(
                Roles: _roles.ToList(),
                Permissions: _permissions.ToList()));
        }
    }

    public Result<AdminUserListResponse> GetAdminUsers(
        Guid? propertyId,
        IReadOnlySet<Guid> callerAllowedPropertyIds)
    {
        lock (_syncRoot)
        {
            var items = _adminUsers
                .Where(u => u.AllowedPropertyIds.Any(callerAllowedPropertyIds.Contains))
                .Where(u => !propertyId.HasValue || u.AllowedPropertyIds.Contains(propertyId.Value))
                .Select(MapAdminUserDto)
                .ToList();

            return Result<AdminUserListResponse>.Success(new AdminUserListResponse(items));
        }
    }

    public Result<AdminUserDto> UpsertAdminUser(UpsertAdminUserCommand command)
    {
        lock (_syncRoot)
        {
            var role = _roles.FirstOrDefault(r =>
                string.Equals(r.Code, command.RoleCode, StringComparison.OrdinalIgnoreCase));

            if (role is null)
            {
                return Result<AdminUserDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Role '{command.RoleCode}' does not exist."));
            }

            AdminUser user;
            if (command.Id.HasValue)
            {
                user = _adminUsers.FirstOrDefault(u => u.Id == command.Id.Value)
                    ?? new AdminUser
                    {
                        Id = command.Id.Value,
                        Username = command.Username.Trim(),
                        FullName = command.FullName.Trim(),
                        Email = command.Email.Trim(),
                        RoleCode = role.Code,
                        RoleName = LocalizedText.Create(role.Name.Th, role.Name.En)
                    };

                if (!_adminUsers.Contains(user))
                {
                    _adminUsers.Add(user);
                }
            }
            else
            {
                user = new AdminUser
                {
                    Username = command.Username.Trim(),
                    FullName = command.FullName.Trim(),
                    Email = command.Email.Trim(),
                    RoleCode = role.Code,
                    RoleName = LocalizedText.Create(role.Name.Th, role.Name.En)
                };
                _adminUsers.Add(user);
            }

            user.Username = command.Username.Trim();
            user.FullName = command.FullName.Trim();
            user.Email = command.Email.Trim();

            try
            {
                user.AssignRoleAndScope(
                    role.Code,
                    LocalizedText.Create(role.Name.Th, role.Name.En),
                    command.AllowedPropertyIds,
                    role.DefaultPermissions,
                    command.IsActive);
            }
            catch (DomainRuleException ex)
            {
                return Result<AdminUserDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }

            return Result<AdminUserDto>.Success(MapAdminUserDto(user));
        }
    }

    public Result<NotificationItemDto> DispatchNotification(DispatchAdminNotificationCommand command)
    {
        if (!Enum.TryParse<NotificationChannel>(command.Channel, ignoreCase: true, out var channel))
        {
            return Result<NotificationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unsupported notification channel '{command.Channel}'."));
        }

        lock (_syncRoot)
        {
            LocalizedText title;
            LocalizedText body;
            try
            {
                title = LocalizedText.Create(command.Title.Th, command.Title.En);
                body = LocalizedText.Create(command.Body.Th, command.Body.En, maxLength: 1000);
            }
            catch (DomainRuleException ex)
            {
                return Result<NotificationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }

            var message = new NotificationMessage
            {
                PropertyId = command.PropertyId,
                CustomerId = command.CustomerId,
                Channel = channel,
                TemplateKey = command.TemplateKey,
                Title = title,
                Body = body,
                SentAtUtc = DateTimeOffset.UtcNow
            };

            _notifications.Insert(0, message);

            return Result<NotificationItemDto>.Success(MapNotificationDto(message));
        }
    }

    public Result<NotificationListResponse> GetClientNotifications(Guid customerId)
    {
        lock (_syncRoot)
        {
            var items = _notifications
                .Where(n => n.CustomerId == customerId)
                .OrderByDescending(n => n.SentAtUtc)
                .Select(MapNotificationDto)
                .ToList();

            return Result<NotificationListResponse>.Success(new NotificationListResponse(items));
        }
    }

    public Result<RoomRackResponse> GetRoomRack(Guid propertyId)
    {
        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var property))
            {
                return Result<RoomRackResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Property '{propertyId}' was not found."));
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

            return Result<RoomRackResponse>.Success(new RoomRackResponse(
                Property: new PropertyRefDto(
                    property.Id,
                    property.Code,
                    LocalizedTextDto.FromDomain(property.Name)),
                Items: items));
        }
    }

    public Result<StaySummaryDto> CheckInStay(
        CheckInStayCommand command,
        bool callerHasOverridePermission)
    {
        if (!Enum.TryParse<StayMode>(command.StayMode, ignoreCase: true, out var stayMode)
            || stayMode == StayMode.Monthly)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "CheckInStay only supports Hourly or Daily StayMode."));
        }

        lock (_syncRoot)
        {
            if (!_units.TryGetValue(command.UnitId, out var unit) || unit.PropertyId != command.PropertyId)
            {
                return Result<StaySummaryDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Unit '{command.UnitId}' does not belong to property '{command.PropertyId}'."));
            }

            if (unit.OccupancyStatus != OccupancyStatus.Vacant)
            {
                return Result<StaySummaryDto>.Failure(new Error(
                    DomainErrorCodes.ReservationSlotOverlap,
                    $"Unit {unit.UnitNumber} is already {unit.OccupancyStatus}."));
            }

            try
            {
                unit.EnsureCanCheckIn(command.OverrideDirtyCheckIn, callerHasOverridePermission, command.OverrideReason);
            }
            catch (DomainRuleException ex)
            {
                return Result<StaySummaryDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }

            if (unit.ConditionStatus != ConditionStatus.Clean && command.OverrideDirtyCheckIn)
            {
                _auditEvents.Add(new AuditEvent
                {
                    PropertyId = command.PropertyId,
                    ActionKey = PermissionKeys.AdminStayOverrideDirtyCheckIn,
                    EntityId = unit.Id,
                    Reason = command.OverrideReason!,
                    BeforeStateJson = $"{{\"conditionStatus\":\"{unit.ConditionStatus}\"}}",
                    AfterStateJson = "{\"occupancyStatus\":\"Occupied\"}"
                });
            }

            var property = _properties[command.PropertyId];
            var docNo = NextDocumentNumberAsync(
                property.Id,
                property.Code,
                DocumentTypeCode.STY,
                DateTimeOffset.UtcNow).GetAwaiter().GetResult();

            if (!_customers.TryGetValue(command.CustomerId, out var customer))
            {
                customer = new Customer
                {
                    Id = command.CustomerId,
                    FullName = "Walk-in Guest",
                    NationalIdOrPassport = "1100501234123"
                };
                _customers[customer.Id] = customer;
            }

            var stay = new Stay
            {
                PropertyId = command.PropertyId,
                DocumentNumber = docNo,
                UnitId = unit.Id,
                CustomerId = customer.Id,
                StayMode = stayMode,
                CheckInAt = DateTimeOffset.UtcNow,
                KeyDepositAmount = command.KeyDepositAmount
            };

            return Result<StaySummaryDto>.Success(new StaySummaryDto(
                Id: stay.Id,
                DocumentNumber: stay.DocumentNumber,
                StayMode: stay.StayMode.ToString(),
                Status: stay.Status.ToString(),
                Unit: _unitRefs[unit.Id],
                Customer: new CustomerRefDto(
                    customer.Id,
                    customer.FullName,
                    customer.GetMaskedIdentity())));
        }
    }

    public Result<ClientDashboardResponse> GetClientDashboard(Guid customerId)
    {
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
                    new LocalizedTextDto("มาตรฐาน 24 ตร.ม.", "Standard 24 sqm"),
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

            return Result<ClientDashboardResponse>.Success(new ClientDashboardResponse(
                Customer: customerDto,
                ActiveHoldReservation: hold,
                ActiveLease: lease,
                UnpaidInvoices: unpaidInvoices,
                PendingParcels: pendingParcels));
        }
    }

    private AdminUserDto MapAdminUserDto(AdminUser user)
    {
        var allowedProps = user.AllowedPropertyIds
            .Where(id => _properties.ContainsKey(id))
            .Select(id =>
            {
                var p = _properties[id];
                return new PropertyRefDto(p.Id, p.Code, LocalizedTextDto.FromDomain(p.Name));
            })
            .ToList();

        return new AdminUserDto(
            Id: user.Id,
            Username: user.Username,
            FullName: user.FullName,
            Email: user.Email,
            RoleCode: user.RoleCode,
            RoleName: LocalizedTextDto.FromDomain(user.RoleName),
            IsActive: user.IsActive,
            AllowedProperties: allowedProps,
            Permissions: user.Permissions.ToList());
    }

    private static NotificationItemDto MapNotificationDto(NotificationMessage message) =>
        new(
            Id: message.Id,
            Channel: message.Channel.ToString(),
            TemplateKey: message.TemplateKey,
            Title: LocalizedTextDto.FromDomain(message.Title),
            Body: LocalizedTextDto.FromDomain(message.Body),
            IsRead: message.IsRead,
            CreatedAt: message.SentAtUtc);

    private void Seed()
    {
        var bkk = new Property
        {
            Id = PmsSeedConstants.BkkPropertyId,
            Code = "BKK01",
            Name = LocalizedText.Create("แทน เรสซิเดนซ์ รัชดา", "TAN Residence Ratchada"),
            TaxBranchCode = "00000"
        };
        var cnx = new Property
        {
            Id = PmsSeedConstants.CnxPropertyId,
            Code = "CNX01",
            Name = LocalizedText.Create("แทน สวีท นิมมาน", "TAN Suites Nimman"),
            TaxBranchCode = "00001"
        };

        _properties[bkk.Id] = bkk;
        _properties[cnx.Id] = cnx;

        _roles.AddRange(
        [
            new RoleDefinitionDto(
                RoleCodes.OrganizationAdmin,
                new LocalizedTextDto("ผู้บริหารระดับองค์กร", "Organization Administrator"),
                "AdminScope",
                PermissionKeys.All),
            new RoleDefinitionDto(
                RoleCodes.PropertyManager,
                new LocalizedTextDto("ผู้จัดการสาขา", "Property Manager"),
                "AdminScope",
                [
                    PermissionKeys.AdminUsersRead,
                    PermissionKeys.AdminPropertiesRead,
                    PermissionKeys.AdminReservationsRead,
                    PermissionKeys.AdminReservationsManage,
                    PermissionKeys.AdminStayCheckIn,
                    PermissionKeys.AdminStayCheckOut,
                    PermissionKeys.AdminStayOverrideDirtyCheckIn,
                    PermissionKeys.AdminCashierReconcileShift,
                    PermissionKeys.AdminInvoicesVoid,
                    PermissionKeys.AdminLeasesSettleMoveOut,
                    PermissionKeys.AdminAnalyticsRead
                ]),
            new RoleDefinitionDto(
                RoleCodes.FrontDeskCashier,
                new LocalizedTextDto("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier"),
                "AdminScope",
                [
                    PermissionKeys.AdminReservationsRead,
                    PermissionKeys.AdminReservationsManage,
                    PermissionKeys.AdminStayCheckIn,
                    PermissionKeys.AdminStayCheckOut,
                    PermissionKeys.AdminCashierOperateShift,
                    PermissionKeys.AdminPaymentsVerifySlip,
                    PermissionKeys.AdminParcelsManage
                ]),
            new RoleDefinitionDto(
                RoleCodes.PropertyAccountant,
                new LocalizedTextDto("ฝ่ายบัญชีประจำสาขา", "Property Accountant"),
                "AdminScope",
                [
                    PermissionKeys.AdminMetersRecord,
                    PermissionKeys.AdminBillingIssueBatch,
                    PermissionKeys.AdminPaymentsVerifySlip,
                    PermissionKeys.AdminAnalyticsRead
                ]),
            new RoleDefinitionDto(
                RoleCodes.HousekeepingStaff,
                new LocalizedTextDto("ฝ่ายแม่บ้าน", "Housekeeping Staff"),
                "AdminScope",
                [PermissionKeys.AdminHousekeepingUpdate]),
            new RoleDefinitionDto(
                RoleCodes.MaintenanceTechnician,
                new LocalizedTextDto("ช่างซ่อมบำรุง", "Maintenance Technician"),
                "AdminScope",
                [PermissionKeys.AdminWorkOrdersManage]),
            new RoleDefinitionDto(
                RoleCodes.ClientCustomer,
                new LocalizedTextDto("ลูกค้า / ผู้เช่า", "Client / Tenant"),
                "ClientScope",
                [])
        ]);

        foreach (var key in PermissionKeys.All)
        {
            var isHighRisk = key is PermissionKeys.AdminStayOverrideDirtyCheckIn
                or PermissionKeys.AdminCustomerUnmaskPii
                or PermissionKeys.AdminLeasesSettleMoveOut
                or PermissionKeys.AdminMetersOverrideLocked
                or PermissionKeys.AdminCashierReconcileShift
                or PermissionKeys.AdminInvoicesVoid
                or PermissionKeys.AdminUsersManage;

            _permissions.Add(new PermissionDefinitionDto(
                Key: key,
                ModuleCode: key.Split('.')[1].ToUpperInvariant(),
                Description: new LocalizedTextDto($"สิทธิ์ {key}", $"Permission {key}"),
                IsHighRisk: isHighRisk));
        }

        var orgAdmin = new AdminUser
        {
            Username = "naphat.admin",
            FullName = "Naphat Wattanakul",
            Email = "naphat@tan-pms.internal",
            RoleCode = RoleCodes.OrganizationAdmin,
            RoleName = LocalizedText.Create("ผู้บริหารระดับองค์กร", "Organization Administrator")
        };
        orgAdmin.AssignRoleAndScope(
            RoleCodes.OrganizationAdmin,
            LocalizedText.Create("ผู้บริหารระดับองค์กร", "Organization Administrator"),
            [bkk.Id, cnx.Id],
            PermissionKeys.All,
            isActive: true);

        var bkkCashier = new AdminUser
        {
            Username = "pimchanok.bkk",
            FullName = "Pimchanok Srisawat",
            Email = "pimchanok@tan-pms.internal",
            RoleCode = RoleCodes.FrontDeskCashier,
            RoleName = LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier")
        };
        bkkCashier.AssignRoleAndScope(
            RoleCodes.FrontDeskCashier,
            LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier"),
            [bkk.Id],
            _roles[2].DefaultPermissions,
            isActive: true);

        var cnxManager = new AdminUser
        {
            Username = "kittisak.cnx",
            FullName = "Kittisak Lertlum",
            Email = "kittisak@tan-pms.internal",
            RoleCode = RoleCodes.PropertyManager,
            RoleName = LocalizedText.Create("ผู้จัดการสาขา", "Property Manager")
        };
        cnxManager.AssignRoleAndScope(
            RoleCodes.PropertyManager,
            LocalizedText.Create("ผู้จัดการสาขา", "Property Manager"),
            [cnx.Id],
            _roles[1].DefaultPermissions,
            isActive: true);

        _adminUsers.AddRange([orgAdmin, bkkCashier, cnxManager]);

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

        var buildingADto = new LocalizedTextDto("อาคาร A", "Building A");
        var standardTypeDto = new LocalizedTextDto("มาตรฐาน 24 ตร.ม.", "Standard 24 sqm");
        var deluxeTypeDto = new LocalizedTextDto("ดีลักซ์ 32 ตร.ม.", "Deluxe 32 sqm");

        _unitRefs[unitA101.Id] = new UnitRefDto(unitA101.Id, "A-101", buildingADto, 1, standardTypeDto);
        _unitRefs[unitA102.Id] = new UnitRefDto(unitA102.Id, "A-102", buildingADto, 1, standardTypeDto);
        _unitRefs[unitA201.Id] = new UnitRefDto(unitA201.Id, "A-201", buildingADto, 2, deluxeTypeDto);

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
        invoice1.AddLine("ค่าเช่าห้องรายเดือน (พ.ย. 2569)", 8500.00m, TaxMode.Exempt, "Monthly Room Rent (Nov 2026)");
        invoice1.AddLine("ค่าเช่าเฟอร์นิเจอร์", 1000.00m, TaxMode.VatExcluded, "Furniture Rental");
        invoice1.Issue();
        _invoices.Add(invoice1);

        var invoice2 = new Invoice
        {
            PropertyId = bkk.Id,
            DocumentNumber = "BKK01-INV-2611-0002",
            CustomerId = customer2.Id
        };
        invoice2.AddLine("ยอดค้างค่าห้องรายวัน", 1200.00m, TaxMode.VatIncluded, "Daily Stay Balance");
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

        _notifications.Add(new NotificationMessage
        {
            PropertyId = bkk.Id,
            CustomerId = customer1.Id,
            Channel = NotificationChannel.InApp,
            TemplateKey = "parcel.arrived",
            Title = LocalizedText.Create("มีพัสดุมาถึงห้อง A-201", "New parcel arrived for Unit A-201"),
            Body = LocalizedText.Create("พัสดุ Kerry Express เลขที่ BKK01-PCL-2611-0001 รอรับที่เคาน์เตอร์", "Parcel BKK01-PCL-2611-0001 from Kerry Express is ready for pickup.")
        });
    }
}
