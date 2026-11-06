using System.Collections.Concurrent;
using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Application.Notifications;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
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
    private readonly Dictionary<Guid, Building> _buildings = [];
    private readonly Dictionary<Guid, Floor> _floors = [];
    private readonly Dictionary<Guid, UnitType> _unitTypes = [];
    private readonly Dictionary<Guid, Unit> _units = [];
    private readonly Dictionary<Guid, RatePlan> _ratePlans = [];
    private readonly Dictionary<Guid, PropertyUtilityTariff> _utilityTariffs = [];
    private readonly Dictionary<Guid, TaxProfile> _taxProfiles = [];
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

    public Result<PropertyHierarchyResponse> GetPropertyHierarchy(Guid propertyId)
    {
        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var prop))
            {
                return Result<PropertyHierarchyResponse>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            var propDetail = new PropertyDetailDto(
                prop.Id,
                prop.Code,
                prop.TaxBranchCode,
                LocalizedTextDto.FromDomain(prop.Name),
                prop.Address is not null ? LocalizedTextDto.FromDomain(prop.Address) : null);

            var propertyBuildings = _buildings.Values
                .Where(b => b.PropertyId == propertyId)
                .OrderBy(b => b.Code)
                .Select(b =>
                {
                    var floors = _floors.Values
                        .Where(f => f.BuildingId == b.Id)
                        .OrderBy(f => f.FloorNumber)
                        .Select(f =>
                        {
                            var unitCount = _units.Values.Count(u => u.FloorId == f.Id);
                            return new FloorDetailDto(f.Id, f.FloorNumber, LocalizedTextDto.FromDomain(f.Name), unitCount);
                        })
                        .ToList();

                    return new BuildingDetailDto(b.Id, b.Code, LocalizedTextDto.FromDomain(b.Name), floors);
                })
                .ToList();

            var propertyUnitTypes = _unitTypes.Values
                .Where(ut => ut.PropertyId == propertyId)
                .OrderBy(ut => ut.Code)
                .Select(ut => new UnitTypeDetailDto(
                    ut.Id,
                    ut.Code,
                    LocalizedTextDto.FromDomain(ut.Name),
                    ut.Description is not null ? LocalizedTextDto.FromDomain(ut.Description) : null,
                    ut.AreaSqm,
                    ut.TotalQuotaUnits,
                    ut.SupportedStayModes.Select(m => m.ToString()).ToList(),
                    ut.HourlyBasePackagePrice,
                    ut.DailyRate,
                    ut.MonthlyRentRate))
                .ToList();

            var propertyUnits = _units.Values
                .Where(u => u.PropertyId == propertyId)
                .OrderBy(u => u.UnitNumber)
                .Select(MapUnitMasterItem)
                .ToList();

            return Result<PropertyHierarchyResponse>.Success(new PropertyHierarchyResponse(
                propDetail,
                propertyBuildings,
                propertyUnitTypes,
                propertyUnits));
        }
    }

    public Result<UnitMasterItemDto> UpsertUnitMaster(Guid propertyId, UpsertUnitMasterRequest request)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            if (!_buildings.TryGetValue(request.BuildingId, out var building) || building.PropertyId != propertyId)
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Building '{request.BuildingId}' is invalid for property '{propertyId}'."));
            }

            if (!_floors.TryGetValue(request.FloorId, out var floor) || floor.BuildingId != building.Id)
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Floor '{request.FloorId}' is invalid for building '{building.Code}'."));
            }

            if (!_unitTypes.TryGetValue(request.UnitTypeId, out var unitType) || unitType.PropertyId != propertyId)
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"UnitType '{request.UnitTypeId}' is invalid for property '{propertyId}'."));
            }

            if (!Enum.TryParse<ConditionStatus>(request.ConditionStatus, true, out var conditionStatus))
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid ConditionStatus '{request.ConditionStatus}'."));
            }

            var stayModes = new List<StayMode>();
            foreach (var modeStr in request.SupportedStayModes)
            {
                if (Enum.TryParse<StayMode>(modeStr, true, out var parsedMode))
                {
                    stayModes.Add(parsedMode);
                }
            }

            if (stayModes.Count == 0)
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    "Unit must support at least one valid StayMode."));
            }

            var existingWithNumber = _units.Values.FirstOrDefault(u =>
                u.PropertyId == propertyId &&
                string.Equals(u.UnitNumber, request.UnitNumber, StringComparison.OrdinalIgnoreCase) &&
                (!request.Id.HasValue || u.Id != request.Id.Value));

            if (existingWithNumber != null)
            {
                return Result<UnitMasterItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Unit number '{request.UnitNumber}' already exists in this property."));
            }

            Unit unit;
            if (request.Id.HasValue && request.Id.Value != Guid.Empty)
            {
                if (!_units.TryGetValue(request.Id.Value, out var existingUnit) || existingUnit.PropertyId != propertyId)
                {
                    return Result<UnitMasterItemDto>.Failure(new Error(
                        DomainErrorCodes.ValidationFailed,
                        $"Unit '{request.Id.Value}' not found."));
                }

                unit = existingUnit;
                unit.BuildingId = building.Id;
                unit.FloorId = floor.Id;
                unit.UnitTypeId = unitType.Id;
                unit.UnitNumber = request.UnitNumber.Trim();
                unit.UpdateConfiguration(stayModes, conditionStatus);
            }
            else
            {
                unit = new Unit
                {
                    Id = Guid.NewGuid(),
                    PropertyId = propertyId,
                    BuildingId = building.Id,
                    FloorId = floor.Id,
                    UnitTypeId = unitType.Id,
                    UnitNumber = request.UnitNumber.Trim()
                };
                unit.UpdateConfiguration(stayModes, conditionStatus);
                _units[unit.Id] = unit;
            }

            var assets = request.Assets.Select(a => new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = propertyId,
                UnitId = unit.Id,
                AssetCode = a.AssetCode.Trim(),
                Name = LocalizedText.Create(a.Name.Th, a.Name.En),
                ReplacementCostAmount = a.ReplacementCostAmount
            }).ToList();

            unit.ReplaceAssets(assets);

            _unitRefs[unit.Id] = new UnitRefDto(
                unit.Id,
                unit.UnitNumber,
                LocalizedTextDto.FromDomain(building.Name),
                floor.FloorNumber,
                LocalizedTextDto.FromDomain(unitType.Name));

            return Result<UnitMasterItemDto>.Success(MapUnitMasterItem(unit));
        }
    }

    private UnitMasterItemDto MapUnitMasterItem(Unit u)
    {
        var building = _buildings.TryGetValue(u.BuildingId, out var b)
            ? new BuildingRefDto(b.Id, b.Code, LocalizedTextDto.FromDomain(b.Name))
            : new BuildingRefDto(u.BuildingId, "UNKNOWN", new LocalizedTextDto("ไม่ระบุอาคาร", "Unknown Building"));

        var floor = _floors.TryGetValue(u.FloorId, out var f)
            ? new FloorRefDto(f.Id, f.FloorNumber, LocalizedTextDto.FromDomain(f.Name))
            : new FloorRefDto(u.FloorId, 0, new LocalizedTextDto("ไม่ระบุชั้น", "Unknown Floor"));

        var unitType = _unitTypes.TryGetValue(u.UnitTypeId, out var ut)
            ? new UnitTypeRefDto(ut.Id, ut.Code, LocalizedTextDto.FromDomain(ut.Name), ut.AreaSqm)
            : new UnitTypeRefDto(u.UnitTypeId, "UNKNOWN", new LocalizedTextDto("ไม่ระบุประเภท", "Unknown Type"), 0m);

        var assets = u.Assets.Select(a => new UnitAssetDto(
            a.Id,
            a.AssetCode,
            LocalizedTextDto.FromDomain(a.Name),
            a.ReplacementCostAmount)).ToList();

        return new UnitMasterItemDto(
            u.Id,
            u.UnitNumber,
            building,
            floor,
            unitType,
            u.OccupancyStatus.ToString(),
            u.ConditionStatus.ToString(),
            u.SupportedStayModes.Select(m => m.ToString()).ToList(),
            assets);
    }

    public Result<PropertyRateCatalogResponse> GetPropertyRateCatalog(Guid propertyId)
    {
        lock (_syncRoot)
        {
            if (!_properties.TryGetValue(propertyId, out var prop))
            {
                return Result<PropertyRateCatalogResponse>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            var propRef = new PropertyRefDto(prop.Id, prop.Code, LocalizedTextDto.FromDomain(prop.Name));

            var ratePlans = _ratePlans.Values
                .Where(rp => rp.PropertyId == propertyId)
                .OrderBy(rp => rp.Code)
                .Select(MapRatePlanDto)
                .ToList();

            var tariffs = _utilityTariffs.Values
                .Where(t => t.PropertyId == propertyId)
                .OrderBy(t => t.UtilityType)
                .Select(MapUtilityTariffDto)
                .ToList();

            var taxProfiles = _taxProfiles.Values
                .Where(tp => tp.PropertyId == propertyId)
                .OrderBy(tp => tp.ChargeCategoryCode)
                .Select(MapTaxProfileDto)
                .ToList();

            return Result<PropertyRateCatalogResponse>.Success(new PropertyRateCatalogResponse(
                propRef,
                ratePlans,
                tariffs,
                taxProfiles));
        }
    }

    public Result<RatePlanItemDto> UpsertRatePlan(Guid propertyId, UpsertRatePlanRequest request)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<RatePlanItemDto>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            if (!_unitTypes.TryGetValue(request.UnitTypeId, out var unitType) || unitType.PropertyId != propertyId)
            {
                return Result<RatePlanItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"UnitType '{request.UnitTypeId}' is invalid for property '{propertyId}'."));
            }

            var parsedModes = new List<StayMode>();
            foreach (var modeStr in request.SupportedStayModes ?? [])
            {
                if (Enum.TryParse<StayMode>(modeStr, true, out var parsedMode))
                {
                    parsedModes.Add(parsedMode);
                }
            }

            var duplicateCode = _ratePlans.Values.FirstOrDefault(rp =>
                rp.PropertyId == propertyId &&
                string.Equals(rp.Code, request.Code?.Trim(), StringComparison.OrdinalIgnoreCase) &&
                (!request.Id.HasValue || rp.Id != request.Id.Value));

            if (duplicateCode is not null)
            {
                return Result<RatePlanItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"RatePlan code '{request.Code}' already exists in this property."));
            }

            try
            {
                var localizedName = LocalizedText.Create(request.Name.Th, request.Name.En);
                RatePlan plan;
                var isNew = false;

                if (request.Id.HasValue && request.Id.Value != Guid.Empty)
                {
                    if (!_ratePlans.TryGetValue(request.Id.Value, out var existingPlan) || existingPlan.PropertyId != propertyId)
                    {
                        return Result<RatePlanItemDto>.Failure(new Error(
                            DomainErrorCodes.ValidationFailed,
                            $"RatePlan '{request.Id.Value}' not found."));
                    }

                    plan = existingPlan;
                }
                else
                {
                    isNew = true;
                    plan = new RatePlan
                    {
                        Id = Guid.NewGuid(),
                        PropertyId = propertyId,
                        UnitTypeId = unitType.Id,
                        Code = request.Code ?? string.Empty,
                        Name = localizedName
                    };
                }

                plan.UpdateConfiguration(
                    code: request.Code ?? string.Empty,
                    name: localizedName,
                    unitTypeId: unitType.Id,
                    supportedStayModes: parsedModes,
                    basePackageHours: request.HourlyPackage.BasePackageHours,
                    basePackagePrice: request.HourlyPackage.BasePackagePrice,
                    additionalHourPrice: request.HourlyPackage.AdditionalHourPrice,
                    gracePeriodMinutes: request.HourlyPackage.GracePeriodMinutes,
                    autoCapToDailyRate: request.HourlyPackage.AutoCapToDailyRate,
                    turnaroundBufferMinutes: request.HourlyPackage.TurnaroundBufferMinutes,
                    weekdayRate: request.DailyRate.WeekdayRate,
                    weekendRate: request.DailyRate.WeekendRate,
                    holidaySurchargeAmount: request.DailyRate.HolidaySurchargeAmount,
                    extraGuestPrice: request.DailyRate.ExtraGuestPrice,
                    monthlyRentRate: request.MonthlyRate.MonthlyRentRate,
                    minimumLeaseMonths: request.MonthlyRate.MinimumLeaseMonths,
                    securityDepositMonths: request.MonthlyRate.SecurityDepositMonths,
                    isActive: request.IsActive);

                if (isNew)
                {
                    _ratePlans[plan.Id] = plan;
                }

                return Result<RatePlanItemDto>.Success(MapRatePlanDto(plan));
            }
            catch (DomainRuleException ex)
            {
                return Result<RatePlanItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<UtilityTariffItemDto> UpsertUtilityTariff(Guid propertyId, UpsertUtilityTariffRequest request)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<UtilityTariffItemDto>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            if (!Enum.TryParse<UtilityType>(request.UtilityType, true, out var utilityType))
            {
                return Result<UtilityTariffItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid UtilityType '{request.UtilityType}'."));
            }

            if (!Enum.TryParse<UtilityBillingMode>(request.BillingMode, true, out var billingMode))
            {
                return Result<UtilityTariffItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid UtilityBillingMode '{request.BillingMode}'."));
            }

            try
            {
                var localizedName = LocalizedText.Create(request.Name.Th, request.Name.En);
                var existing = _utilityTariffs.Values.FirstOrDefault(t =>
                    t.PropertyId == propertyId && t.UtilityType == utilityType);

                var isNew = false;
                if (existing is null)
                {
                    isNew = true;
                    existing = new PropertyUtilityTariff
                    {
                        Id = Guid.NewGuid(),
                        PropertyId = propertyId,
                        UtilityType = utilityType,
                        Name = localizedName
                    };
                }

                existing.UpdateTariff(
                    name: localizedName,
                    billingMode: billingMode,
                    ratePerUnit: request.RatePerUnit,
                    minimumChargeAmount: request.MinimumChargeAmount,
                    includedUnits: request.IncludedUnits,
                    baseMinimumAmount: request.BaseMinimumAmount,
                    flatRateAmount: request.FlatRateAmount,
                    flatRatePerOccupant: request.FlatRatePerOccupant,
                    meterMaxDigits: request.MeterMaxDigits);

                if (isNew)
                {
                    _utilityTariffs[existing.Id] = existing;
                }

                return Result<UtilityTariffItemDto>.Success(MapUtilityTariffDto(existing));
            }
            catch (DomainRuleException ex)
            {
                return Result<UtilityTariffItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<TaxProfileItemDto> UpsertTaxProfile(Guid propertyId, UpsertTaxProfileRequest request)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<TaxProfileItemDto>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            if (!Enum.TryParse<TaxMode>(request.TaxMode, true, out var taxMode))
            {
                return Result<TaxProfileItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid TaxMode '{request.TaxMode}'."));
            }

            var duplicateCategory = _taxProfiles.Values.FirstOrDefault(tp =>
                tp.PropertyId == propertyId &&
                string.Equals(tp.ChargeCategoryCode, request.ChargeCategoryCode?.Trim(), StringComparison.OrdinalIgnoreCase) &&
                (!request.Id.HasValue || tp.Id != request.Id.Value));

            if (duplicateCategory is not null)
            {
                return Result<TaxProfileItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"ChargeCategoryCode '{request.ChargeCategoryCode}' already exists in this property."));
            }

            try
            {
                var localizedName = LocalizedText.Create(request.Name.Th, request.Name.En);
                TaxProfile profile;
                var isNew = false;

                if (request.Id.HasValue && request.Id.Value != Guid.Empty)
                {
                    if (!_taxProfiles.TryGetValue(request.Id.Value, out var existingProfile) || existingProfile.PropertyId != propertyId)
                    {
                        return Result<TaxProfileItemDto>.Failure(new Error(
                            DomainErrorCodes.ValidationFailed,
                            $"TaxProfile '{request.Id.Value}' not found."));
                    }

                    profile = existingProfile;
                }
                else
                {
                    isNew = true;
                    profile = new TaxProfile
                    {
                        Id = Guid.NewGuid(),
                        PropertyId = propertyId,
                        ChargeCategoryCode = request.ChargeCategoryCode ?? string.Empty,
                        Name = localizedName
                    };
                }

                profile.UpdateProfile(
                    chargeCategoryCode: request.ChargeCategoryCode ?? string.Empty,
                    name: localizedName,
                    taxMode: taxMode,
                    vatRatePercent: request.VatRatePercent,
                    defaultWithholdingTaxPercent: request.DefaultWithholdingTaxPercent,
                    isActive: request.IsActive);

                if (isNew)
                {
                    _taxProfiles[profile.Id] = profile;
                }

                return Result<TaxProfileItemDto>.Success(MapTaxProfileDto(profile));
            }
            catch (DomainRuleException ex)
            {
                return Result<TaxProfileItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<RateSimulationResponse> SimulateRateAndTax(Guid propertyId, RateSimulationRequest request)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<RateSimulationResponse>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Property '{propertyId}' not found."));
            }

            if (!_ratePlans.TryGetValue(request.RatePlanId, out var ratePlan) || ratePlan.PropertyId != propertyId)
            {
                return Result<RateSimulationResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"RatePlan '{request.RatePlanId}' not found for property '{propertyId}'."));
            }

            if (!_taxProfiles.TryGetValue(request.TaxProfileId, out var taxProfile) || taxProfile.PropertyId != propertyId)
            {
                return Result<RateSimulationResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"TaxProfile '{request.TaxProfileId}' not found for property '{propertyId}'."));
            }

            var waterTariffEntity = _utilityTariffs.Values.FirstOrDefault(t =>
                t.PropertyId == propertyId && t.UtilityType == UtilityType.Water);
            var electricTariffEntity = _utilityTariffs.Values.FirstOrDefault(t =>
                t.PropertyId == propertyId && t.UtilityType == UtilityType.Electric);

            if (waterTariffEntity is null || electricTariffEntity is null)
            {
                return Result<RateSimulationResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    "Water and Electric tariffs must be configured for the property."));
            }

            try
            {
                var hourlyCalc = HourlyPricingCalculator.Calculate(request.DurationMinutes, ratePlan.ToHourlyRateRule());
                var waterCalc = UtilityMeterCalculator.Calculate(
                    previousReading: request.WaterPreviousReading,
                    currentReading: request.WaterCurrentReading,
                    tariff: waterTariffEntity.ToUtilityTariff(),
                    isRolloverConfirmed: request.WaterRolloverConfirmed,
                    meterMaxDigits: waterTariffEntity.MeterMaxDigits,
                    occupantCount: Math.Max(request.OccupantCount, 1));

                var electricCalc = UtilityMeterCalculator.Calculate(
                    previousReading: request.ElectricPreviousReading,
                    currentReading: request.ElectricCurrentReading,
                    tariff: electricTariffEntity.ToUtilityTariff(),
                    isRolloverConfirmed: request.ElectricRolloverConfirmed,
                    meterMaxDigits: electricTariffEntity.MeterMaxDigits,
                    occupantCount: Math.Max(request.OccupantCount, 1));

                var lineTax = ThaiTaxCalculator.CalculateLine(
                    lineAmount: request.SampleLineAmount,
                    taxMode: taxProfile.TaxMode,
                    vatRate: taxProfile.GetDecimalVatRate());

                var whtPercent = request.ApplyWithholdingTax ? taxProfile.DefaultWithholdingTaxPercent : 0m;
                var whtBreakdown = ThaiTaxCalculator.CalculateWithholdingTax(
                    subTotal: lineTax.SubTotal,
                    invoiceTotal: lineTax.TotalAmount,
                    whtRate: whtPercent / 100m);

                return Result<RateSimulationResponse>.Success(new RateSimulationResponse(
                    HourlyQuote: new HourlySimulationQuoteDto(
                        DurationMinutes: hourlyCalc.DurationMinutes,
                        ExtraHours: hourlyCalc.ExtraHours,
                        RawCharge: hourlyCalc.RawCharge,
                        FinalHourlyRoomCharge: hourlyCalc.FinalHourlyRoomCharge,
                        IsCappedToDailyRate: hourlyCalc.IsCappedToDailyRate,
                        TurnaroundBufferMinutes: ratePlan.TurnaroundBufferMinutes),
                    WaterQuote: new UtilitySimulationQuoteDto(
                        UtilityType: UtilityType.Water.ToString(),
                        UsageUnits: waterCalc.UsageUnits,
                        ChargeAmount: waterCalc.ChargeAmount,
                        UsedRollover: waterCalc.UsedRollover),
                    ElectricQuote: new UtilitySimulationQuoteDto(
                        UtilityType: UtilityType.Electric.ToString(),
                        UsageUnits: electricCalc.UsageUnits,
                        ChargeAmount: electricCalc.ChargeAmount,
                        UsedRollover: electricCalc.UsedRollover),
                    TaxQuote: new TaxSimulationQuoteDto(
                        TaxMode: taxProfile.TaxMode.ToString(),
                        VatRatePercent: taxProfile.VatRatePercent,
                        SubTotal: lineTax.SubTotal,
                        VatAmount: lineTax.VatAmount,
                        InvoiceTotal: lineTax.TotalAmount,
                        WithholdingTaxPercent: whtPercent,
                        WithholdingTaxAmount: whtBreakdown.WithholdingTaxAmount,
                        NetPayable: whtBreakdown.NetPayable)));
            }
            catch (DomainRuleException ex)
            {
                return Result<RateSimulationResponse>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private RatePlanItemDto MapRatePlanDto(RatePlan plan)
    {
        var unitType = _unitTypes.TryGetValue(plan.UnitTypeId, out var ut)
            ? new UnitTypeRefDto(ut.Id, ut.Code, LocalizedTextDto.FromDomain(ut.Name), ut.AreaSqm)
            : new UnitTypeRefDto(plan.UnitTypeId, "UNKNOWN", new LocalizedTextDto("ไม่ระบุประเภท", "Unknown Type"), 0m);

        return new RatePlanItemDto(
            Id: plan.Id,
            Code: plan.Code,
            Name: LocalizedTextDto.FromDomain(plan.Name),
            UnitType: unitType,
            SupportedStayModes: plan.SupportedStayModes.Select(m => m.ToString()).ToList(),
            HourlyPackage: new HourlyPackageConfigDto(
                plan.BasePackageHours,
                plan.BasePackagePrice,
                plan.AdditionalHourPrice,
                plan.GracePeriodMinutes,
                plan.AutoCapToDailyRate,
                plan.TurnaroundBufferMinutes),
            DailyRate: new DailyRateConfigDto(
                plan.WeekdayRate,
                plan.WeekendRate,
                plan.HolidaySurchargeAmount,
                plan.ExtraGuestPrice),
            MonthlyRate: new MonthlyRateConfigDto(
                plan.MonthlyRentRate,
                plan.MinimumLeaseMonths,
                plan.SecurityDepositMonths),
            IsActive: plan.IsActive);
    }

    private static UtilityTariffItemDto MapUtilityTariffDto(PropertyUtilityTariff tariff) =>
        new(
            Id: tariff.Id,
            UtilityType: tariff.UtilityType.ToString(),
            Name: LocalizedTextDto.FromDomain(tariff.Name),
            BillingMode: tariff.BillingMode.ToString(),
            RatePerUnit: tariff.RatePerUnit,
            MinimumChargeAmount: tariff.MinimumChargeAmount,
            IncludedUnits: tariff.IncludedUnits,
            BaseMinimumAmount: tariff.BaseMinimumAmount,
            FlatRateAmount: tariff.FlatRateAmount,
            FlatRatePerOccupant: tariff.FlatRatePerOccupant,
            MeterMaxDigits: tariff.MeterMaxDigits);

    private static TaxProfileItemDto MapTaxProfileDto(TaxProfile profile) =>
        new(
            Id: profile.Id,
            ChargeCategoryCode: profile.ChargeCategoryCode,
            Name: LocalizedTextDto.FromDomain(profile.Name),
            TaxMode: profile.TaxMode.ToString(),
            VatRatePercent: profile.VatRatePercent,
            DefaultWithholdingTaxPercent: profile.DefaultWithholdingTaxPercent,
            IsActive: profile.IsActive);

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
            TaxBranchCode = "00000",
            Address = LocalizedText.Create("123 ถนนรัชดาภิเษก ดินแดง กรุงเทพฯ 10400", "123 Ratchadaphisek Rd, Din Daeng, Bangkok 10400")
        };
        bkk.ValidateTaxBranchCode();

        var cnx = new Property
        {
            Id = PmsSeedConstants.CnxPropertyId,
            Code = "CNX01",
            Name = LocalizedText.Create("แทน สวีท นิมมาน", "TAN Suites Nimman"),
            TaxBranchCode = "00001",
            Address = LocalizedText.Create("45 ถนนนิมมานเหมินท์ สุเทพ เมือง เชียงใหม่ 50200", "45 Nimmanhaemin Rd, Suthep, Mueang, Chiang Mai 50200")
        };
        cnx.ValidateTaxBranchCode();

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

        var buildingA = new Building
        {
            Id = PmsSeedConstants.BkkBuildingAId,
            PropertyId = bkk.Id,
            Code = "BLD-A",
            Name = LocalizedText.Create("อาคาร A (เรสซิเดนซ์)", "Building A (Residence)")
        };

        var floor1 = new Floor
        {
            Id = PmsSeedConstants.BkkFloor1Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorNumber = 1,
            Name = LocalizedText.Create("ชั้น 1", "Floor 1")
        };

        var floor2 = new Floor
        {
            Id = PmsSeedConstants.BkkFloor2Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorNumber = 2,
            Name = LocalizedText.Create("ชั้น 2", "Floor 2")
        };

        _buildings[buildingA.Id] = buildingA;
        _floors[floor1.Id] = floor1;
        _floors[floor2.Id] = floor2;

        var standardType = new UnitType
        {
            Id = PmsSeedConstants.StandardUnitTypeId,
            PropertyId = bkk.Id,
            Code = "STD",
            Name = LocalizedText.Create("มาตรฐาน 24 ตร.ม.", "Standard 24 sqm"),
            Description = LocalizedText.Create("ห้องมาตรฐาน 1 ห้องนอน", "Standard 1-bedroom room"),
            AreaSqm = 24m,
            TotalQuotaUnits = 2,
            SupportedStayModes = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            HourlyBasePackagePrice = 500m,
            HourlyBasePackageHours = 3,
            HourlyAdditionalHourPrice = 150m,
            DailyRate = 1200m,
            MonthlyRentRate = 7500m
        };

        var deluxeType = new UnitType
        {
            Id = PmsSeedConstants.DeluxeUnitTypeId,
            PropertyId = bkk.Id,
            Code = "DLX",
            Name = LocalizedText.Create("ดีลักซ์ 32 ตร.ม.", "Deluxe 32 sqm"),
            Description = LocalizedText.Create("ห้องดีลักซ์ พร้อมระเบียง", "Deluxe room with balcony"),
            AreaSqm = 32m,
            TotalQuotaUnits = 1,
            SupportedStayModes = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            HourlyBasePackagePrice = 700m,
            HourlyBasePackageHours = 3,
            HourlyAdditionalHourPrice = 200m,
            DailyRate = 1600m,
            MonthlyRentRate = 9500m
        };

        _unitTypes[standardType.Id] = standardType;
        _unitTypes[deluxeType.Id] = deluxeType;

        var unitA101 = new Unit
        {
            Id = PmsSeedConstants.CleanUnitA101Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorId = floor1.Id,
            UnitTypeId = standardType.Id,
            UnitNumber = "A-101"
        };
        unitA101.UpdateConfiguration([StayMode.Hourly, StayMode.Daily, StayMode.Monthly], ConditionStatus.Clean);
        unitA101.ReplaceAssets([
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA101.Id,
                AssetCode = "AST-00001",
                Name = LocalizedText.Create("แอร์ Daikin Inverter", "Daikin Inverter AC"),
                ReplacementCostAmount = 18000m
            },
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA101.Id,
                AssetCode = "AST-00002",
                Name = LocalizedText.Create("สมาร์ททีวี Samsung 43 นิ้ว", "Samsung 43-inch Smart TV"),
                ReplacementCostAmount = 12000m
            },
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA101.Id,
                AssetCode = "AST-00003",
                Name = LocalizedText.Create("ชุดคีย์การ์ดและกุญแจ", "Keycard & Room Key Set"),
                ReplacementCostAmount = 500m
            }
        ]);

        var unitA102 = new Unit
        {
            Id = PmsSeedConstants.DirtyUnitA102Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorId = floor1.Id,
            UnitTypeId = standardType.Id,
            UnitNumber = "A-102"
        };
        unitA102.UpdateConfiguration([StayMode.Hourly, StayMode.Daily, StayMode.Monthly], ConditionStatus.Dirty);
        unitA102.ReplaceAssets([
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA102.Id,
                AssetCode = "AST-00004",
                Name = LocalizedText.Create("แอร์ Daikin Inverter", "Daikin Inverter AC"),
                ReplacementCostAmount = 18000m
            },
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA102.Id,
                AssetCode = "AST-00005",
                Name = LocalizedText.Create("ชุดคีย์การ์ดและกุญแจ", "Keycard & Room Key Set"),
                ReplacementCostAmount = 500m
            }
        ]);

        var unitA201 = new Unit
        {
            Id = PmsSeedConstants.OccupiedMonthlyUnitA201Id,
            PropertyId = bkk.Id,
            BuildingId = buildingA.Id,
            FloorId = floor2.Id,
            UnitTypeId = deluxeType.Id,
            UnitNumber = "A-201"
        };
        unitA201.UpdateConfiguration([StayMode.Daily, StayMode.Monthly], ConditionStatus.Clean);
        unitA201.MarkOccupied();
        unitA201.ReplaceAssets([
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA201.Id,
                AssetCode = "AST-00006",
                Name = LocalizedText.Create("สมาร์ททีวี Sony 55 นิ้ว", "Sony 55-inch Smart TV"),
                ReplacementCostAmount = 22000m
            },
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA201.Id,
                AssetCode = "AST-00007",
                Name = LocalizedText.Create("ตู้เย็น 2 ประตู 7.4 คิว", "2-Door Refrigerator 7.4 cu.ft"),
                ReplacementCostAmount = 8500m
            },
            new UnitAsset
            {
                Id = Guid.NewGuid(),
                PropertyId = bkk.Id,
                UnitId = unitA201.Id,
                AssetCode = "AST-00008",
                Name = LocalizedText.Create("ชุดคีย์การ์ดและกุญแจ", "Keycard & Room Key Set"),
                ReplacementCostAmount = 500m
            }
        ]);

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

        var standardRatePlan = new RatePlan
        {
            Id = PmsSeedConstants.StandardRatePlanId,
            PropertyId = bkk.Id,
            UnitTypeId = standardType.Id,
            Code = "RP-STD-2026",
            Name = LocalizedText.Create("เรตมาตรฐาน 3 โหมด (Standard)", "Standard 3-Mode Rate Plan")
        };
        standardRatePlan.UpdateConfiguration(
            code: "RP-STD-2026",
            name: standardRatePlan.Name,
            unitTypeId: standardType.Id,
            supportedStayModes: [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            basePackageHours: 3,
            basePackagePrice: 500.00m,
            additionalHourPrice: 150.00m,
            gracePeriodMinutes: 15,
            autoCapToDailyRate: 1200.00m,
            turnaroundBufferMinutes: 30,
            weekdayRate: 1200.00m,
            weekendRate: 1400.00m,
            holidaySurchargeAmount: 250.00m,
            extraGuestPrice: 300.00m,
            monthlyRentRate: 7500.00m,
            minimumLeaseMonths: 6,
            securityDepositMonths: 2,
            isActive: true);

        var deluxeRatePlan = new RatePlan
        {
            Id = PmsSeedConstants.DeluxeRatePlanId,
            PropertyId = bkk.Id,
            UnitTypeId = deluxeType.Id,
            Code = "RP-DLX-2026",
            Name = LocalizedText.Create("เรตดีลักซ์ พรีเมียม (Deluxe)", "Deluxe Premium Rate Plan")
        };
        deluxeRatePlan.UpdateConfiguration(
            code: "RP-DLX-2026",
            name: deluxeRatePlan.Name,
            unitTypeId: deluxeType.Id,
            supportedStayModes: [StayMode.Hourly, StayMode.Daily, StayMode.Monthly],
            basePackageHours: 3,
            basePackagePrice: 700.00m,
            additionalHourPrice: 200.00m,
            gracePeriodMinutes: 15,
            autoCapToDailyRate: 1600.00m,
            turnaroundBufferMinutes: 30,
            weekdayRate: 1600.00m,
            weekendRate: 1850.00m,
            holidaySurchargeAmount: 350.00m,
            extraGuestPrice: 400.00m,
            monthlyRentRate: 9500.00m,
            minimumLeaseMonths: 6,
            securityDepositMonths: 2,
            isActive: true);

        _ratePlans[standardRatePlan.Id] = standardRatePlan;
        _ratePlans[deluxeRatePlan.Id] = deluxeRatePlan;

        var bkkWaterTariff = new PropertyUtilityTariff
        {
            Id = PmsSeedConstants.BkkWaterTariffId,
            PropertyId = bkk.Id,
            UtilityType = UtilityType.Water,
            Name = LocalizedText.Create("อัตราค่าน้ำประปา (เหมาขั้นต่ำ 5 หน่วย)", "Water Tariff (5 Units Minimum)")
        };
        bkkWaterTariff.UpdateTariff(
            name: bkkWaterTariff.Name,
            billingMode: UtilityBillingMode.MinimumUnits,
            ratePerUnit: 18.00m,
            minimumChargeAmount: 100.00m,
            includedUnits: 5.00m,
            baseMinimumAmount: 100.00m,
            flatRateAmount: 0.00m,
            flatRatePerOccupant: false,
            meterMaxDigits: 4);

        var bkkElectricTariff = new PropertyUtilityTariff
        {
            Id = PmsSeedConstants.BkkElectricTariffId,
            PropertyId = bkk.Id,
            UtilityType = UtilityType.Electric,
            Name = LocalizedText.Create("อัตราค่าไฟฟ้า (คิดตามหน่วยจริง)", "Electricity Tariff (Per Unit)")
        };
        bkkElectricTariff.UpdateTariff(
            name: bkkElectricTariff.Name,
            billingMode: UtilityBillingMode.PerUnit,
            ratePerUnit: 8.00m,
            minimumChargeAmount: 100.00m,
            includedUnits: 0.00m,
            baseMinimumAmount: 0.00m,
            flatRateAmount: 0.00m,
            flatRatePerOccupant: false,
            meterMaxDigits: 4);

        _utilityTariffs[bkkWaterTariff.Id] = bkkWaterTariff;
        _utilityTariffs[bkkElectricTariff.Id] = bkkElectricTariff;

        var monthlyRentTax = new TaxProfile
        {
            Id = PmsSeedConstants.MonthlyRentExemptTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "MONTHLY_ROOM_RENT",
            Name = LocalizedText.Create("ค่าเช่าห้องพักตามสัญญารายเดือน (ยกเว้น VAT)", "Monthly Lease Room Rent (VAT Exempt)")
        };
        monthlyRentTax.UpdateProfile(
            chargeCategoryCode: "MONTHLY_ROOM_RENT",
            name: monthlyRentTax.Name,
            taxMode: TaxMode.Exempt,
            vatRatePercent: 0.00m,
            defaultWithholdingTaxPercent: 5.00m,
            isActive: true);

        var shortStayTax = new TaxProfile
        {
            Id = PmsSeedConstants.ShortStayVatIncludedTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "SHORT_STAY_ROOM",
            Name = LocalizedText.Create("ค่าห้องพักรายชั่วโมง/รายวัน (รวม VAT 7%)", "Hourly & Daily Stay Charge (VAT 7% Included)")
        };
        shortStayTax.UpdateProfile(
            chargeCategoryCode: "SHORT_STAY_ROOM",
            name: shortStayTax.Name,
            taxMode: TaxMode.VatIncluded,
            vatRatePercent: 7.00m,
            defaultWithholdingTaxPercent: 0.00m,
            isActive: true);

        var furnitureTax = new TaxProfile
        {
            Id = PmsSeedConstants.FurnitureVatExcludedTaxProfileId,
            PropertyId = bkk.Id,
            ChargeCategoryCode = "FURNITURE_RENTAL",
            Name = LocalizedText.Create("ค่าเช่าเฟอร์นิเจอร์และบริการ (แยก VAT 7%)", "Furniture & Service Fee (VAT 7% Excluded)")
        };
        furnitureTax.UpdateProfile(
            chargeCategoryCode: "FURNITURE_RENTAL",
            name: furnitureTax.Name,
            taxMode: TaxMode.VatExcluded,
            vatRatePercent: 7.00m,
            defaultWithholdingTaxPercent: 5.00m,
            isActive: true);

        _taxProfiles[monthlyRentTax.Id] = monthlyRentTax;
        _taxProfiles[shortStayTax.Id] = shortStayTax;
        _taxProfiles[furnitureTax.Id] = furnitureTax;
    }
}
