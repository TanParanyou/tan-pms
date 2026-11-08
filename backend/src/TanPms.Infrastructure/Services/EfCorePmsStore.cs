using System.Text;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TanPms.Application.Billing;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Application.Notifications;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
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
using TanPms.Infrastructure.Persistence;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore : IPmsOperationalStore
{
    private readonly TanPmsDbContext _dbContext;
    private readonly IDocumentNumberService _documentNumberService;

    public EfCorePmsStore(
        TanPmsDbContext dbContext,
        IDocumentNumberService documentNumberService)
    {
        _dbContext = dbContext;
        _documentNumberService = documentNumberService;
    }

    public Result<AuthSessionResponse> Login(LoginAuthSessionCommand command)
    {
        var isClient = string.Equals(command.Scope, "client", StringComparison.OrdinalIgnoreCase);
        if (isClient)
        {
            var customer = EnsureCustomerExists(PmsSeedConstants.PrimaryCustomerId, "Somchai Rakdee", "1100501234123");
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

        var adminUsers = _dbContext.AdminUsers
            .AsNoTracking()
            .OrderBy(u => u.Username)
            .ToList();

        var matchedUser = adminUsers.FirstOrDefault(u =>
                string.Equals(u.Username, command.Identifier, StringComparison.OrdinalIgnoreCase)
                || string.Equals(u.Email, command.Identifier, StringComparison.OrdinalIgnoreCase))
            ?? adminUsers.FirstOrDefault(u => u.RoleCode == RoleCodes.OrganizationAdmin)
            ?? adminUsers.FirstOrDefault();

        if (matchedUser is null)
        {
            return Result<AuthSessionResponse>.Failure(new Error(
                DomainErrorCodes.InvalidCredentials,
                "No administrator account is configured."));
        }

        var propertiesById = _dbContext.Properties
            .AsNoTracking()
            .ToDictionary(p => p.Id);

        var allowedProps = matchedUser.AllowedPropertyIds
            .Where(propertiesById.ContainsKey)
            .Select(id =>
            {
                var prop = propertiesById[id];
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

    public Result<AuthSessionResponse> GetCurrentAuthSession(ICurrentUserContext currentUser)
    {
        if (currentUser.IsClientScope)
        {
            var customerId = currentUser.CustomerId ?? PmsSeedConstants.PrimaryCustomerId;
            var customer = _dbContext.Customers
                .AsNoTracking()
                .FirstOrDefault(c => c.Id == customerId)
                ?? EnsureCustomerExists(PmsSeedConstants.PrimaryCustomerId, "Somchai Rakdee", "1100501234123");

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

        var propertiesById = _dbContext.Properties
            .AsNoTracking()
            .ToDictionary(p => p.Id);

        var allowedProps = currentUser.AllowedPropertyIds
            .Where(propertiesById.ContainsKey)
            .Select(id =>
            {
                var prop = propertiesById[id];
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

    public Result<RoleCatalogResponse> GetRoleCatalog() =>
        Result<RoleCatalogResponse>.Success(new RoleCatalogResponse(
            Roles: PmsRoleCatalog.Roles,
            Permissions: PmsRoleCatalog.Permissions));

    public Result<AdminUserListResponse> GetAdminUsers(
        Guid? propertyId,
        IReadOnlySet<Guid> callerAllowedPropertyIds)
    {
        var propertiesById = _dbContext.Properties
            .AsNoTracking()
            .ToDictionary(p => p.Id);

        var users = _dbContext.AdminUsers
            .AsNoTracking()
            .OrderBy(u => u.Username)
            .ToList();

        var items = users
            .Where(u => u.AllowedPropertyIds.Any(callerAllowedPropertyIds.Contains))
            .Where(u => !propertyId.HasValue || u.AllowedPropertyIds.Contains(propertyId.Value))
            .Select(u => MapAdminUserDto(u, propertiesById))
            .ToList();

        return Result<AdminUserListResponse>.Success(new AdminUserListResponse(items));
    }

    public Result<AdminUserDto> UpsertAdminUser(UpsertAdminUserCommand command)
    {
        var role = PmsRoleCatalog.Roles.FirstOrDefault(r =>
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
            var existing = _dbContext.AdminUsers.FirstOrDefault(u => u.Id == command.Id.Value);
            if (existing is not null)
            {
                user = existing;
            }
            else
            {
                user = new AdminUser
                {
                    Id = command.Id.Value,
                    Username = command.Username.Trim(),
                    FullName = command.FullName.Trim(),
                    Email = command.Email.Trim(),
                    RoleCode = role.Code,
                    RoleName = LocalizedText.Create(role.Name.Th, role.Name.En)
                };
                _dbContext.AdminUsers.Add(user);
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
            _dbContext.AdminUsers.Add(user);
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

            _dbContext.SaveChanges();
        }
        catch (DomainRuleException ex)
        {
            return Result<AdminUserDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }

        var propertiesById = _dbContext.Properties
            .AsNoTracking()
            .ToDictionary(p => p.Id);

        return Result<AdminUserDto>.Success(MapAdminUserDto(user, propertiesById));
    }

    public Result<NotificationItemDto> DispatchNotification(DispatchAdminNotificationCommand command)
    {
        if (!Enum.TryParse<NotificationChannel>(command.Channel, ignoreCase: true, out var channel))
        {
            return Result<NotificationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unsupported notification channel '{command.Channel}'."));
        }

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

        _dbContext.NotificationMessages.Add(message);
        _dbContext.SaveChanges();

        return Result<NotificationItemDto>.Success(MapNotificationDto(message));
    }

    public Result<NotificationListResponse> GetClientNotifications(Guid customerId)
    {
        var items = _dbContext.NotificationMessages
            .AsNoTracking()
            .Where(n => n.CustomerId == customerId)
            .OrderByDescending(n => n.SentAtUtc)
            .Select(MapNotificationDto)
            .ToList();

        return Result<NotificationListResponse>.Success(new NotificationListResponse(items));
    }

    public Result<PropertyHierarchyResponse> GetPropertyHierarchy(Guid propertyId)
    {
        var prop = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == propertyId);

        if (prop is null)
        {
            return Result<PropertyHierarchyResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Property '{propertyId}' not found."));
        }

        var buildings = _dbContext.Buildings
            .AsNoTracking()
            .Where(b => b.PropertyId == propertyId)
            .OrderBy(b => b.Code)
            .ToList();

        var floors = _dbContext.Floors
            .AsNoTracking()
            .Where(f => f.PropertyId == propertyId)
            .OrderBy(f => f.FloorNumber)
            .ToList();

        var unitTypes = _dbContext.UnitTypes
            .AsNoTracking()
            .Where(ut => ut.PropertyId == propertyId)
            .OrderBy(ut => ut.Code)
            .ToList();

        var units = _dbContext.Units
            .AsNoTracking()
            .Include(u => u.Assets)
            .Where(u => u.PropertyId == propertyId)
            .OrderBy(u => u.UnitNumber)
            .ToList();

        var buildingsById = buildings.ToDictionary(b => b.Id);
        var floorsById = floors.ToDictionary(f => f.Id);
        var unitTypesById = unitTypes.ToDictionary(ut => ut.Id);

        var propDetail = new PropertyDetailDto(
            prop.Id,
            prop.Code,
            prop.TaxBranchCode,
            LocalizedTextDto.FromDomain(prop.Name),
            prop.Address is not null ? LocalizedTextDto.FromDomain(prop.Address) : null);

        var propertyBuildings = buildings
            .Select(b =>
            {
                var buildingFloors = floors
                    .Where(f => f.BuildingId == b.Id)
                    .OrderBy(f => f.FloorNumber)
                    .Select(f =>
                    {
                        var unitCount = units.Count(u => u.FloorId == f.Id);
                        return new FloorDetailDto(f.Id, f.FloorNumber, LocalizedTextDto.FromDomain(f.Name), unitCount);
                    })
                    .ToList();

                return new BuildingDetailDto(b.Id, b.Code, LocalizedTextDto.FromDomain(b.Name), buildingFloors);
            })
            .ToList();

        var propertyUnitTypes = unitTypes
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

        var propertyUnits = units
            .Select(u => MapUnitMasterItem(u, buildingsById, floorsById, unitTypesById))
            .ToList();

        return Result<PropertyHierarchyResponse>.Success(new PropertyHierarchyResponse(
            propDetail,
            propertyBuildings,
            propertyUnitTypes,
            propertyUnits));
    }

    public Result<UnitMasterItemDto> UpsertUnitMaster(Guid propertyId, UpsertUnitMasterRequest request)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Property '{propertyId}' not found."));
        }

        var building = _dbContext.Buildings
            .AsNoTracking()
            .FirstOrDefault(b => b.Id == request.BuildingId && b.PropertyId == propertyId);
        if (building is null)
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Building '{request.BuildingId}' is invalid for property '{propertyId}'."));
        }

        var floor = _dbContext.Floors
            .AsNoTracking()
            .FirstOrDefault(f => f.Id == request.FloorId && f.BuildingId == building.Id);
        if (floor is null)
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Floor '{request.FloorId}' is invalid for building '{building.Code}'."));
        }

        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .FirstOrDefault(ut => ut.Id == request.UnitTypeId && ut.PropertyId == propertyId);
        if (unitType is null)
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

        var normalizedUnitNumber = request.UnitNumber.Trim();
        var duplicateExists = _dbContext.Units
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId && (!request.Id.HasValue || u.Id != request.Id.Value))
            .AsEnumerable()
            .Any(u => string.Equals(u.UnitNumber, normalizedUnitNumber, StringComparison.OrdinalIgnoreCase));

        if (duplicateExists)
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unit number '{request.UnitNumber}' already exists in this property."));
        }

        try
        {
            Unit unit;
            if (request.Id.HasValue && request.Id.Value != Guid.Empty)
            {
                var existingUnit = _dbContext.Units
                    .Include(u => u.Assets)
                    .FirstOrDefault(u => u.Id == request.Id.Value && u.PropertyId == propertyId);
                if (existingUnit is null)
                {
                    return Result<UnitMasterItemDto>.Failure(new Error(
                        DomainErrorCodes.ValidationFailed,
                        $"Unit '{request.Id.Value}' not found."));
                }

                if (existingUnit.Assets.Count > 0)
                {
                    _dbContext.UnitAssets.RemoveRange(existingUnit.Assets.ToList());
                }

                unit = existingUnit;
                unit.BuildingId = building.Id;
                unit.FloorId = floor.Id;
                unit.UnitTypeId = unitType.Id;
                unit.UnitNumber = normalizedUnitNumber;
                unit.UpdateConfiguration(stayModes, conditionStatus);
            }
            else
            {
                unit = new Unit
                {
                    Id = Guid.CreateVersion7(),
                    PropertyId = propertyId,
                    BuildingId = building.Id,
                    FloorId = floor.Id,
                    UnitTypeId = unitType.Id,
                    UnitNumber = normalizedUnitNumber
                };
                unit.UpdateConfiguration(stayModes, conditionStatus);
                _dbContext.Units.Add(unit);
            }

            var assets = request.Assets.Select(a => new UnitAsset
            {
                Id = Guid.CreateVersion7(),
                PropertyId = propertyId,
                UnitId = unit.Id,
                AssetCode = a.AssetCode.Trim(),
                Name = LocalizedText.Create(a.Name.Th, a.Name.En),
                ReplacementCostAmount = a.ReplacementCostAmount
            }).ToList();

            unit.ReplaceAssets(assets);
            if (assets.Count > 0)
            {
                _dbContext.UnitAssets.AddRange(assets);
            }

            _dbContext.SaveChanges();

            var buildingsById = new Dictionary<Guid, Building> { [building.Id] = building };
            var floorsById = new Dictionary<Guid, Floor> { [floor.Id] = floor };
            var unitTypesById = new Dictionary<Guid, UnitType> { [unitType.Id] = unitType };

            return Result<UnitMasterItemDto>.Success(
                MapUnitMasterItem(unit, buildingsById, floorsById, unitTypesById));
        }
        catch (DomainRuleException ex)
        {
            return Result<UnitMasterItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<PropertyRateCatalogResponse> GetPropertyRateCatalog(Guid propertyId)
    {
        var prop = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == propertyId);

        if (prop is null)
        {
            return Result<PropertyRateCatalogResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Property '{propertyId}' not found."));
        }

        var unitTypesById = _dbContext.UnitTypes
            .AsNoTracking()
            .Where(ut => ut.PropertyId == propertyId)
            .ToDictionary(ut => ut.Id);

        var propRef = new PropertyRefDto(prop.Id, prop.Code, LocalizedTextDto.FromDomain(prop.Name));

        var ratePlans = _dbContext.RatePlans
            .AsNoTracking()
            .Where(rp => rp.PropertyId == propertyId)
            .OrderBy(rp => rp.Code)
            .AsEnumerable()
            .Select(rp => MapRatePlanDto(rp, unitTypesById))
            .ToList();

        var tariffs = _dbContext.PropertyUtilityTariffs
            .AsNoTracking()
            .Where(t => t.PropertyId == propertyId)
            .OrderBy(t => t.UtilityType)
            .Select(MapUtilityTariffDto)
            .ToList();

        var taxProfiles = _dbContext.TaxProfiles
            .AsNoTracking()
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

    public Result<RatePlanItemDto> UpsertRatePlan(Guid propertyId, UpsertRatePlanRequest request)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<RatePlanItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Property '{propertyId}' not found."));
        }

        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .FirstOrDefault(ut => ut.Id == request.UnitTypeId && ut.PropertyId == propertyId);
        if (unitType is null)
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

        var normalizedCode = request.Code?.Trim() ?? string.Empty;
        var duplicateCode = _dbContext.RatePlans
            .AsNoTracking()
            .Where(rp => rp.PropertyId == propertyId && (!request.Id.HasValue || rp.Id != request.Id.Value))
            .AsEnumerable()
            .Any(rp => string.Equals(rp.Code, normalizedCode, StringComparison.OrdinalIgnoreCase));

        if (duplicateCode)
        {
            return Result<RatePlanItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"RatePlan code '{request.Code}' already exists in this property."));
        }

        try
        {
            var localizedName = LocalizedText.Create(request.Name.Th, request.Name.En);
            RatePlan plan;

            if (request.Id.HasValue && request.Id.Value != Guid.Empty)
            {
                var existingPlan = _dbContext.RatePlans
                    .FirstOrDefault(rp => rp.Id == request.Id.Value && rp.PropertyId == propertyId);
                if (existingPlan is null)
                {
                    return Result<RatePlanItemDto>.Failure(new Error(
                        DomainErrorCodes.ValidationFailed,
                        $"RatePlan '{request.Id.Value}' not found."));
                }

                plan = existingPlan;
            }
            else
            {
                plan = new RatePlan
                {
                    Id = Guid.CreateVersion7(),
                    PropertyId = propertyId,
                    UnitTypeId = unitType.Id,
                    Code = normalizedCode,
                    Name = localizedName
                };
                _dbContext.RatePlans.Add(plan);
            }

            plan.UpdateConfiguration(
                code: normalizedCode,
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

            _dbContext.SaveChanges();

            var unitTypesById = new Dictionary<Guid, UnitType> { [unitType.Id] = unitType };
            return Result<RatePlanItemDto>.Success(MapRatePlanDto(plan, unitTypesById));
        }
        catch (DomainRuleException ex)
        {
            return Result<RatePlanItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<UtilityTariffItemDto> UpsertUtilityTariff(Guid propertyId, UpsertUtilityTariffRequest request)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
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
            var existing = _dbContext.PropertyUtilityTariffs
                .FirstOrDefault(t => t.PropertyId == propertyId && t.UtilityType == utilityType);

            if (existing is null)
            {
                existing = new PropertyUtilityTariff
                {
                    Id = Guid.CreateVersion7(),
                    PropertyId = propertyId,
                    UtilityType = utilityType,
                    Name = localizedName
                };
                _dbContext.PropertyUtilityTariffs.Add(existing);
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

            _dbContext.SaveChanges();
            return Result<UtilityTariffItemDto>.Success(MapUtilityTariffDto(existing));
        }
        catch (DomainRuleException ex)
        {
            return Result<UtilityTariffItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<TaxProfileItemDto> UpsertTaxProfile(Guid propertyId, UpsertTaxProfileRequest request)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
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

        var normalizedCategory = request.ChargeCategoryCode?.Trim() ?? string.Empty;
        var duplicateCategory = _dbContext.TaxProfiles
            .AsNoTracking()
            .Where(tp => tp.PropertyId == propertyId && (!request.Id.HasValue || tp.Id != request.Id.Value))
            .AsEnumerable()
            .Any(tp => string.Equals(tp.ChargeCategoryCode, normalizedCategory, StringComparison.OrdinalIgnoreCase));

        if (duplicateCategory)
        {
            return Result<TaxProfileItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"ChargeCategoryCode '{request.ChargeCategoryCode}' already exists in this property."));
        }

        try
        {
            var localizedName = LocalizedText.Create(request.Name.Th, request.Name.En);
            TaxProfile profile;

            if (request.Id.HasValue && request.Id.Value != Guid.Empty)
            {
                var existingProfile = _dbContext.TaxProfiles
                    .FirstOrDefault(tp => tp.Id == request.Id.Value && tp.PropertyId == propertyId);
                if (existingProfile is null)
                {
                    return Result<TaxProfileItemDto>.Failure(new Error(
                        DomainErrorCodes.ValidationFailed,
                        $"TaxProfile '{request.Id.Value}' not found."));
                }

                profile = existingProfile;
            }
            else
            {
                profile = new TaxProfile
                {
                    Id = Guid.CreateVersion7(),
                    PropertyId = propertyId,
                    ChargeCategoryCode = normalizedCategory,
                    Name = localizedName
                };
                _dbContext.TaxProfiles.Add(profile);
            }

            profile.UpdateProfile(
                chargeCategoryCode: normalizedCategory,
                name: localizedName,
                taxMode: taxMode,
                vatRatePercent: request.VatRatePercent,
                defaultWithholdingTaxPercent: request.DefaultWithholdingTaxPercent,
                isActive: request.IsActive);

            _dbContext.SaveChanges();
            return Result<TaxProfileItemDto>.Success(MapTaxProfileDto(profile));
        }
        catch (DomainRuleException ex)
        {
            return Result<TaxProfileItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<RateSimulationResponse> SimulateRateAndTax(Guid propertyId, RateSimulationRequest request)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<RateSimulationResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Property '{propertyId}' not found."));
        }

        var ratePlan = _dbContext.RatePlans
            .AsNoTracking()
            .FirstOrDefault(rp => rp.Id == request.RatePlanId && rp.PropertyId == propertyId);
        if (ratePlan is null)
        {
            return Result<RateSimulationResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"RatePlan '{request.RatePlanId}' not found for property '{propertyId}'."));
        }

        var taxProfile = _dbContext.TaxProfiles
            .AsNoTracking()
            .FirstOrDefault(tp => tp.Id == request.TaxProfileId && tp.PropertyId == propertyId);
        if (taxProfile is null)
        {
            return Result<RateSimulationResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"TaxProfile '{request.TaxProfileId}' not found for property '{propertyId}'."));
        }

        var waterTariffEntity = _dbContext.PropertyUtilityTariffs
            .AsNoTracking()
            .FirstOrDefault(t => t.PropertyId == propertyId && t.UtilityType == UtilityType.Water);
        var electricTariffEntity = _dbContext.PropertyUtilityTariffs
            .AsNoTracking()
            .FirstOrDefault(t => t.PropertyId == propertyId && t.UtilityType == UtilityType.Electric);

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

    public Result<AvailabilitySearchResponse> SearchAvailability(
        Guid propertyId,
        string stayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        DateTimeOffset? nowUtc = null)
    {
        if (!Enum.TryParse<StayMode>(stayMode, ignoreCase: true, out var parsedStayMode))
        {
            return Result<AvailabilitySearchResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Invalid StayMode '{stayMode}'."));
        }

        if (slotEndAt <= slotStartAt)
        {
            return Result<AvailabilitySearchResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Requested SlotEndAt must be strictly after SlotStartAt."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var property = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<AvailabilitySearchResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        ExpireStaleHolds(propertyId, clockUtc);

        var unitTypes = _dbContext.UnitTypes
            .AsNoTracking()
            .Where(ut => ut.PropertyId == propertyId)
            .OrderBy(ut => ut.AreaSqm)
            .ToList()
            .Where(ut => ut.SupportedStayModes.Contains(parsedStayMode))
            .ToList();

        var propertyUnits = _dbContext.Units
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId)
            .ToList();
        var unitsById = propertyUnits.ToDictionary(u => u.Id);

        var buildingsById = _dbContext.Buildings
            .AsNoTracking()
            .Where(b => b.PropertyId == propertyId)
            .ToDictionary(b => b.Id);

        var floorsById = _dbContext.Floors
            .AsNoTracking()
            .Where(f => f.PropertyId == propertyId)
            .ToDictionary(f => f.Id);

        var activeRatePlans = _dbContext.RatePlans
            .AsNoTracking()
            .Where(rp => rp.PropertyId == propertyId && rp.IsActive)
            .ToList();

        var propertyLeases = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId)
            .ToList();

        var propertyStays = _dbContext.Stays
            .AsNoTracking()
            .Where(s => s.PropertyId == propertyId)
            .ToList();

        var propertyReservations = _dbContext.Reservations
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId)
            .ToList();

        var items = new List<UnitTypeAvailabilityDto>();
        foreach (var unitType in unitTypes)
        {
            var ratePlan = activeRatePlans.FirstOrDefault(rp => rp.UnitTypeId == unitType.Id);
            var turnaroundBufferMinutes = ratePlan?.TurnaroundBufferMinutes ?? 30;

            var availability = UnifiedAvailabilityCalculator.EvaluateUnitTypeAvailability(
                unitType: unitType,
                unitsOfUnitType: propertyUnits.Where(u => u.UnitTypeId == unitType.Id),
                propertyLeases: propertyLeases,
                propertyStays: propertyStays,
                propertyReservations: propertyReservations,
                requestedStayMode: parsedStayMode,
                slotStartAt: slotStartAt,
                slotEndAt: slotEndAt,
                nowUtc: clockUtc,
                turnaroundBufferMinutes: turnaroundBufferMinutes);

            var (estimatedRoomRate, estimatedDepositAmount) = ComputeEstimatedQuote(
                unitType,
                ratePlan,
                parsedStayMode,
                slotStartAt,
                slotEndAt);

            var assignableUnits = availability.AvailableUnitIds
                .Where(unitsById.ContainsKey)
                .Select(id =>
                {
                    var u = unitsById[id];
                    var b = buildingsById[u.BuildingId];
                    var f = floorsById[u.FloorId];
                    return new AssignableUnitOptionDto(
                        Id: u.Id,
                        UnitNumber: u.UnitNumber,
                        BuildingName: LocalizedTextDto.FromDomain(b.Name),
                        FloorNumber: f.FloorNumber,
                        ConditionStatus: u.ConditionStatus.ToString());
                })
                .OrderBy(u => u.UnitNumber)
                .ToList();

            items.Add(new UnitTypeAvailabilityDto(
                UnitType: new UnitTypeRefDto(
                    unitType.Id,
                    unitType.Code,
                    LocalizedTextDto.FromDomain(unitType.Name),
                    unitType.AreaSqm),
                SupportedStayModes: unitType.SupportedStayModes.Select(m => m.ToString()).ToList(),
                TotalPhysicalUnits: availability.TotalPhysicalUnits,
                UnassignedQuotaHeld: availability.UnassignedQuotaHeld,
                NetAvailableQuota: availability.NetAvailableQuota,
                TurnaroundBufferMinutes: availability.TurnaroundBufferMinutes,
                EstimatedRoomRate: estimatedRoomRate,
                EstimatedDepositAmount: estimatedDepositAmount,
                AvailableUnits: assignableUnits));
        }

        return Result<AvailabilitySearchResponse>.Success(new AvailabilitySearchResponse(
            Property: new PropertyRefDto(
                property.Id,
                property.Code,
                LocalizedTextDto.FromDomain(property.Name)),
            StayMode: parsedStayMode.ToString(),
            SlotStartAt: slotStartAt,
            SlotEndAt: slotEndAt,
            Items: items));
    }

    public Result<ReservationListResponse> GetAdminReservations(
        Guid propertyId,
        string? status,
        string? stayMode,
        DateTimeOffset? nowUtc = null)
    {
        ReservationStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<ReservationStatus>(status, ignoreCase: true, out var parsedStatus))
            {
                return Result<ReservationListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid ReservationStatus '{status}'."));
            }

            statusFilter = parsedStatus;
        }

        StayMode? stayModeFilter = null;
        if (!string.IsNullOrWhiteSpace(stayMode))
        {
            if (!Enum.TryParse<StayMode>(stayMode, ignoreCase: true, out var parsedStayMode))
            {
                return Result<ReservationListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid StayMode '{stayMode}'."));
            }

            stayModeFilter = parsedStayMode;
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<ReservationListResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        ExpireStaleHolds(propertyId, clockUtc);

        var query = _dbContext.Reservations
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId);

        if (statusFilter.HasValue)
        {
            query = query.Where(r => r.Status == statusFilter.Value);
        }

        if (stayModeFilter.HasValue)
        {
            query = query.Where(r => r.StayMode == stayModeFilter.Value);
        }

        var reservations = query
            .OrderByDescending(r => r.SlotStartAt)
            .ThenByDescending(r => r.DocumentNumber)
            .ToList();

        var items = MapReservationItems(reservations);
        return Result<ReservationListResponse>.Success(new ReservationListResponse(items));
    }

    public Result<ReservationItemDto> CreateAdminReservation(
        Guid propertyId,
        CreateAdminReservationRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (!Enum.TryParse<StayMode>(request.StayMode, ignoreCase: true, out var parsedStayMode))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Invalid StayMode '{request.StayMode}'."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var property = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .FirstOrDefault(ut => ut.Id == request.UnitTypeId && ut.PropertyId == propertyId);
        if (unitType is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"UnitType '{request.UnitTypeId}' does not belong to property '{propertyId}'."));
        }

        if (!unitType.SupportedStayModes.Contains(parsedStayMode))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"UnitType '{unitType.Code}' does not support StayMode '{parsedStayMode}'."));
        }

        if (request.UnitId.HasValue)
        {
            var unitExists = _dbContext.Units
                .AsNoTracking()
                .Any(u => u.Id == request.UnitId.Value && u.PropertyId == propertyId && u.UnitTypeId == unitType.Id);
            if (!unitExists)
            {
                return Result<ReservationItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Unit '{request.UnitId}' does not belong to UnitType '{unitType.Code}' in property '{propertyId}'."));
            }
        }

        using var tx = BeginTransactionIfNeeded();

        try
        {
            LockUnitTypeRow(unitType.Id);
            ExpireStaleHolds(propertyId, clockUtc);

            var ratePlan = FindActiveRatePlan(propertyId, unitType.Id);
            var turnaroundBufferMinutes = ratePlan?.TurnaroundBufferMinutes ?? 30;

            var availability = EvaluateUnitTypeAvailabilityFromDb(
                propertyId,
                unitType,
                parsedStayMode,
                request.SlotStartAt,
                request.SlotEndAt,
                clockUtc,
                turnaroundBufferMinutes);

            if (request.UnitId.HasValue)
            {
                UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(request.UnitId.Value, availability);
            }

            UnifiedAvailabilityCalculator.EnsureQuotaAvailable(availability);

            EnsureCustomerExists(request.CustomerId);

            var docNo = _documentNumberService.NextDocumentNumberAsync(
                property.Id,
                property.Code,
                DocumentTypeCode.RES,
                clockUtc).GetAwaiter().GetResult();

            var reservation = Reservation.CreateByAdmin(
                propertyId: propertyId,
                documentNumber: docNo,
                customerId: request.CustomerId,
                unitTypeId: unitType.Id,
                stayMode: parsedStayMode,
                slotStartAt: request.SlotStartAt,
                slotEndAt: request.SlotEndAt,
                depositAmount: request.DepositAmount,
                nowUtc: clockUtc,
                confirmImmediately: request.ConfirmImmediately,
                unitId: request.UnitId);

            _dbContext.Reservations.Add(reservation);
            _dbContext.SaveChanges();
            tx?.Commit();

            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (IsExclusionViolation(ex))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                "Requested time slot overlaps with an existing reservation on this unit."));
        }
    }

    public Result<ReservationItemDto> AssignReservationUnit(
        Guid propertyId,
        Guid reservationId,
        Guid unitId,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        using var tx = BeginTransactionIfNeeded();

        var reservation = _dbContext.Reservations
            .FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
        if (reservation is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Reservation '{reservationId}' was not found in property '{propertyId}'."));
        }

        LockUnitTypeRow(reservation.UnitTypeId);
        ExpireStaleHolds(propertyId, clockUtc);

        if (reservation.Status == ReservationStatus.Expired)
        {
            tx?.Commit();
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ReservationHoldExpired,
                $"Reservation {reservation.DocumentNumber} hold has already expired."));
        }

        var unit = _dbContext.Units
            .AsNoTracking()
            .FirstOrDefault(u => u.Id == unitId && u.PropertyId == propertyId && u.UnitTypeId == reservation.UnitTypeId);
        if (unit is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unit '{unitId}' does not match reservation UnitType '{reservation.UnitTypeId}'."));
        }

        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .First(ut => ut.Id == reservation.UnitTypeId);
        var ratePlan = FindActiveRatePlan(propertyId, unitType.Id);
        var turnaroundBufferMinutes = ratePlan?.TurnaroundBufferMinutes ?? 30;

        try
        {
            var availability = EvaluateUnitTypeAvailabilityFromDb(
                propertyId,
                unitType,
                reservation.StayMode,
                reservation.SlotStartAt,
                reservation.SlotEndAt,
                clockUtc,
                turnaroundBufferMinutes,
                ignoreReservationId: reservation.Id);

            UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(unitId, availability);
            UnifiedAvailabilityCalculator.EnsureQuotaAvailable(availability);

            reservation.AssignUnit(unitId);
            _dbContext.SaveChanges();
            tx?.Commit();

            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (IsExclusionViolation(ex))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                "Assigned unit already has an overlapping active reservation."));
        }
    }

    public Result<ReservationItemDto> ConfirmReservation(
        Guid propertyId,
        Guid reservationId,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var reservation = _dbContext.Reservations
            .FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
        if (reservation is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Reservation '{reservationId}' was not found in property '{propertyId}'."));
        }

        ExpireStaleHolds(propertyId, clockUtc);

        if (reservation.Status == ReservationStatus.Expired)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ReservationHoldExpired,
                $"Reservation {reservation.DocumentNumber} hold has already expired."));
        }

        try
        {
            reservation.ConfirmByAdmin();
            _dbContext.SaveChanges();
            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<ReservationItemDto> CancelReservation(
        Guid propertyId,
        Guid reservationId,
        CancelReservationRequest request,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var reservation = _dbContext.Reservations
            .FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
        if (reservation is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Reservation '{reservationId}' was not found in property '{propertyId}'."));
        }

        ExpireStaleHolds(propertyId, clockUtc);

        try
        {
            if (request.MarkNoShow)
            {
                reservation.MarkNoShow(request.Reason);
            }
            else
            {
                reservation.Cancel(request.Reason);
            }

            _dbContext.SaveChanges();
            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<ReservationListResponse> GetClientReservations(
        Guid customerId,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        ExpireStaleHolds(null, clockUtc);

        var reservations = _dbContext.Reservations
            .AsNoTracking()
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.SlotStartAt)
            .ThenByDescending(r => r.DocumentNumber)
            .ToList();

        return Result<ReservationListResponse>.Success(
            new ReservationListResponse(MapReservationItems(reservations)));
    }

    public Result<ReservationItemDto> CreateClientHoldReservation(
        Guid customerId,
        CreateClientHoldReservationRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (!Enum.TryParse<StayMode>(request.StayMode, ignoreCase: true, out var parsedStayMode))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Invalid StayMode '{request.StayMode}'."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var property = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == request.PropertyId);
        if (property is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{request.PropertyId}' was not found."));
        }

        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .FirstOrDefault(ut => ut.Id == request.UnitTypeId && ut.PropertyId == request.PropertyId);
        if (unitType is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"UnitType '{request.UnitTypeId}' does not belong to property '{request.PropertyId}'."));
        }

        if (!unitType.SupportedStayModes.Contains(parsedStayMode))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"UnitType '{unitType.Code}' does not support StayMode '{parsedStayMode}'."));
        }

        if (request.UnitId.HasValue)
        {
            var unitExists = _dbContext.Units
                .AsNoTracking()
                .Any(u => u.Id == request.UnitId.Value && u.PropertyId == request.PropertyId && u.UnitTypeId == unitType.Id);
            if (!unitExists)
            {
                return Result<ReservationItemDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Unit '{request.UnitId}' does not belong to UnitType '{unitType.Code}' in property '{request.PropertyId}'."));
            }
        }

        using var tx = BeginTransactionIfNeeded();

        try
        {
            LockUnitTypeRow(unitType.Id);
            ExpireStaleHolds(request.PropertyId, clockUtc);

            var ratePlan = FindActiveRatePlan(request.PropertyId, unitType.Id);
            var turnaroundBufferMinutes = ratePlan?.TurnaroundBufferMinutes ?? 30;

            var availability = EvaluateUnitTypeAvailabilityFromDb(
                request.PropertyId,
                unitType,
                parsedStayMode,
                request.SlotStartAt,
                request.SlotEndAt,
                clockUtc,
                turnaroundBufferMinutes);

            if (request.UnitId.HasValue)
            {
                UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(request.UnitId.Value, availability);
            }

            UnifiedAvailabilityCalculator.EnsureQuotaAvailable(availability);

            EnsureCustomerExists(customerId);

            var (_, estimatedDepositAmount) = ComputeEstimatedQuote(
                unitType,
                ratePlan,
                parsedStayMode,
                request.SlotStartAt,
                request.SlotEndAt);

            var docNo = _documentNumberService.NextDocumentNumberAsync(
                property.Id,
                property.Code,
                DocumentTypeCode.RES,
                clockUtc).GetAwaiter().GetResult();

            var reservation = Reservation.CreateOnlineHold(
                propertyId: request.PropertyId,
                documentNumber: docNo,
                customerId: customerId,
                unitTypeId: unitType.Id,
                stayMode: parsedStayMode,
                slotStartAt: request.SlotStartAt,
                slotEndAt: request.SlotEndAt,
                depositAmount: estimatedDepositAmount,
                nowUtc: clockUtc,
                holdTtlMinutes: 15,
                unitId: request.UnitId);

            _dbContext.Reservations.Add(reservation);
            _dbContext.SaveChanges();
            tx?.Commit();

            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (IsExclusionViolation(ex))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                "Requested time slot overlaps with an existing reservation on this unit."));
        }
    }

    public Result<ReservationItemDto> SubmitClientReservationSlip(
        Guid customerId,
        Guid reservationId,
        SubmitReservationSlipRequest request,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var reservation = _dbContext.Reservations.FirstOrDefault(r => r.Id == reservationId);
        if (reservation is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Reservation '{reservationId}' was not found."));
        }

        if (reservation.CustomerId != customerId)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Client cannot submit slip for another customer's reservation."));
        }

        try
        {
            reservation.SubmitPaymentSlip(request.PaymentSlipFileKey, clockUtc);
            _dbContext.SaveChanges();
            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<RoomRackResponse> GetRoomRack(Guid propertyId)
    {
        var property = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<RoomRackResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        var units = _dbContext.Units
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId)
            .OrderBy(u => u.UnitNumber)
            .ToList();

        var unitRefs = BuildUnitRefsForProperty(propertyId, units);

        var activeStays = _dbContext.Stays
            .AsNoTracking()
            .Where(s => s.PropertyId == propertyId && s.Status == StayStatus.Active)
            .ToList();

        var activeLeases = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId)
            .ToList()
            .Where(l => l.BlocksUnitAvailability)
            .ToList();

        var customerIds = activeStays.Select(s => s.CustomerId)
            .Concat(activeLeases.Select(l => l.CustomerId))
            .Distinct()
            .ToList();

        var customersById = _dbContext.Customers
            .AsNoTracking()
            .Where(c => customerIds.Contains(c.Id))
            .ToDictionary(c => c.Id);

        var clockUtc = DateTimeOffset.UtcNow;
        var items = units
            .Select(u =>
            {
                var unitRef = unitRefs[u.Id];
                var activeStay = activeStays.FirstOrDefault(s => s.UnitId == u.Id);
                if (activeStay is not null)
                {
                    var stayCust = customersById.TryGetValue(activeStay.CustomerId, out var sc)
                        ? sc
                        : EnsureCustomerExists(activeStay.CustomerId);
                    return new RoomRackItemDto(
                        Unit: unitRef,
                        OccupancyStatus: u.OccupancyStatus.ToString(),
                        ConditionStatus: u.ConditionStatus.ToString(),
                        SupportedStayModes: u.SupportedStayModes.Select(m => m.ToString()).ToList(),
                        ActiveStayMode: activeStay.StayMode.ToString(),
                        ActiveDocumentNumber: activeStay.DocumentNumber,
                        Customer: new CustomerRefDto(
                            stayCust.Id,
                            stayCust.FullName,
                            stayCust.GetMaskedIdentity()),
                        RemainingMinutes: activeStay.GetRemainingMinutes(clockUtc));
                }

                var activeLease = activeLeases.FirstOrDefault(l => l.UnitId == u.Id);
                if (activeLease is not null)
                {
                    var leaseCust = customersById.TryGetValue(activeLease.CustomerId, out var lc)
                        ? lc
                        : EnsureCustomerExists(activeLease.CustomerId);
                    return new RoomRackItemDto(
                        Unit: unitRef,
                        OccupancyStatus: u.OccupancyStatus.ToString(),
                        ConditionStatus: u.ConditionStatus.ToString(),
                        SupportedStayModes: u.SupportedStayModes.Select(m => m.ToString()).ToList(),
                        ActiveStayMode: StayMode.Monthly.ToString(),
                        ActiveDocumentNumber: activeLease.DocumentNumber,
                        Customer: new CustomerRefDto(
                            leaseCust.Id,
                            leaseCust.FullName,
                            leaseCust.GetMaskedIdentity()),
                        RemainingMinutes: null);
                }

                return new RoomRackItemDto(
                    Unit: unitRef,
                    OccupancyStatus: u.OccupancyStatus.ToString(),
                    ConditionStatus: u.ConditionStatus.ToString(),
                    SupportedStayModes: u.SupportedStayModes.Select(m => m.ToString()).ToList(),
                    ActiveStayMode: null,
                    ActiveDocumentNumber: null,
                    Customer: null,
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

    public Result<StaySummaryDto> CheckInStay(
        CheckInStayCommand command,
        bool callerHasOverridePermission,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null)
    {
        if (!Enum.TryParse<StayMode>(command.StayMode, ignoreCase: true, out var stayMode)
            || stayMode == StayMode.Monthly)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "CheckInStay only supports Hourly or Daily StayMode."));
        }

        if (command.KeyDepositAmount < 0m)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "KeyDepositAmount cannot be negative."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        using var tx = BeginTransactionIfNeeded();

        var unit = _dbContext.Units
            .FirstOrDefault(u => u.Id == command.UnitId && u.PropertyId == command.PropertyId);
        if (unit is null)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Unit '{command.UnitId}' does not belong to property '{command.PropertyId}'."));
        }

        LockUnitRow(unit.Id);
        _dbContext.Entry(unit).Reload();

        if (unit.OccupancyStatus != OccupancyStatus.Vacant)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Unit {unit.UnitNumber} is already {unit.OccupancyStatus}."));
        }

        Reservation? linkedReservation = null;
        if (command.ReservationId.HasValue)
        {
            linkedReservation = _dbContext.Reservations.FirstOrDefault(r =>
                r.Id == command.ReservationId.Value && r.PropertyId == command.PropertyId);
            if (linkedReservation is null)
            {
                return Result<StaySummaryDto>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Reservation '{command.ReservationId}' was not found in property '{command.PropertyId}'."));
            }
        }

        try
        {
            unit.EnsureCanCheckIn(command.OverrideDirtyCheckIn, callerHasOverridePermission, command.OverrideReason);
        }
        catch (DomainRuleException ex)
        {
            return Result<StaySummaryDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }

        try
        {
            if (unit.ConditionStatus != ConditionStatus.Clean && command.OverrideDirtyCheckIn)
            {
                _dbContext.AuditEvents.Add(new AuditEvent
                {
                    PropertyId = command.PropertyId,
                    ActionKey = PermissionKeys.AdminStayOverrideDirtyCheckIn,
                    EntityId = unit.Id,
                    Reason = command.OverrideReason!,
                    BeforeStateJson = $"{{\"conditionStatus\":\"{unit.ConditionStatus}\"}}",
                    AfterStateJson = "{\"occupancyStatus\":\"Occupied\"}"
                });
            }

            unit.MarkOccupied();
            linkedReservation?.MarkCheckedIn(unit.Id);

            var property = _dbContext.Properties
                .AsNoTracking()
                .First(p => p.Id == command.PropertyId);

            var docNo = _documentNumberService.NextDocumentNumberAsync(
                property.Id,
                property.Code,
                DocumentTypeCode.STY,
                clockUtc).GetAwaiter().GetResult();

            var customer = EnsureCustomerExists(command.CustomerId, "Walk-in Guest", "1100501234123");
            var unitType = _dbContext.UnitTypes
                .AsNoTracking()
                .First(ut => ut.Id == unit.UnitTypeId);
            var ratePlan = FindActiveRatePlan(command.PropertyId, unit.UnitTypeId);
            var baseHours = ratePlan?.BasePackageHours ?? unitType.HourlyBasePackageHours;
            var expectedCheckOutAt = command.ExpectedCheckOutAt
                ?? (stayMode == StayMode.Hourly
                    ? clockUtc.AddHours(Math.Max(1, baseHours))
                    : clockUtc.AddDays(1));

            var stay = new Stay
            {
                PropertyId = command.PropertyId,
                DocumentNumber = docNo,
                UnitId = unit.Id,
                CustomerId = customer.Id,
                ReservationId = linkedReservation?.Id,
                StayMode = stayMode,
                CheckInAt = clockUtc,
                ExpectedCheckOutAt = expectedCheckOutAt,
                KeyDepositAmount = decimal.Round(command.KeyDepositAmount, 2, MidpointRounding.AwayFromZero)
            };
            _dbContext.Stays.Add(stay);

            var folio = new Folio
            {
                PropertyId = command.PropertyId,
                StayId = stay.Id
            };

            decimal initialRoomCharge;
            if (command.InitialRoomChargeAmount.HasValue)
            {
                initialRoomCharge = command.InitialRoomChargeAmount.Value;
            }
            else if (stayMode == StayMode.Hourly)
            {
                var durationMins = Math.Max(60, (int)Math.Ceiling((expectedCheckOutAt - clockUtc).TotalMinutes));
                initialRoomCharge = ratePlan is not null
                    ? HourlyPricingCalculator.Calculate(durationMins, ratePlan.ToHourlyRateRule()).FinalHourlyRoomCharge
                    : unitType.HourlyBasePackagePrice;
            }
            else
            {
                var nights = Math.Max(1, (int)Math.Ceiling((expectedCheckOutAt - clockUtc).TotalDays));
                var nightly = ratePlan?.WeekdayRate ?? unitType.DailyRate;
                initialRoomCharge = decimal.Round(nights * nightly, 2, MidpointRounding.AwayFromZero);
            }

            var chargeTitleTh = stayMode == StayMode.Hourly
                ? $"ค่าแพ็กเกจห้องพักรายชั่วโมง ({unit.UnitNumber})"
                : $"ค่าห้องพักรายวัน ({unit.UnitNumber})";
            var chargeTitleEn = stayMode == StayMode.Hourly
                ? $"Hourly Room Package ({unit.UnitNumber})"
                : $"Daily Room Charge ({unit.UnitNumber})";
            folio.AddCharge(chargeTitleTh, initialRoomCharge, TaxMode.VatIncluded, chargeTitleEn, UtilityChargeCategories.ShortStayRoom);

            _dbContext.Folios.Add(folio);
            _dbContext.Set<FolioCharge>().AddRange(folio.Charges);

            if (stay.KeyDepositAmount > 0m)
            {
                var ledger = new DepositLedger
                {
                    PropertyId = command.PropertyId,
                    CustomerId = customer.Id,
                    StayId = stay.Id,
                    DepositType = DepositType.KeyDeposit
                };
                var depDocNo = _documentNumberService.NextDocumentNumberAsync(
                    property.Id,
                    property.Code,
                    DocumentTypeCode.DEP,
                    clockUtc).GetAwaiter().GetResult();
                ledger.RecordReceipt(depDocNo, stay.KeyDepositAmount, FindTrackedOpenShift(command.PropertyId, cashierUserId));
                _dbContext.DepositLedgers.Add(ledger);
                _dbContext.DepositTransactions.AddRange(ledger.Transactions);
            }

            if (command.Occupants is { Count: > 0 })
            {
                foreach (var occInput in command.Occupants)
                {
                    _dbContext.Occupants.Add(new Occupant
                    {
                        PropertyId = command.PropertyId,
                        CustomerId = customer.Id,
                        StayId = stay.Id,
                        FullName = occInput.FullName.Trim(),
                        NationalityCode = string.IsNullOrWhiteSpace(occInput.NationalityCode)
                            ? "THA"
                            : occInput.NationalityCode.Trim().ToUpperInvariant(),
                        IdentityNumber = occInput.IdentityNumber.Trim(),
                        IsPrimaryOccupant = occInput.IsPrimaryOccupant,
                        VehicleLicensePlate = string.IsNullOrWhiteSpace(occInput.VehicleLicensePlate)
                            ? null
                            : occInput.VehicleLicensePlate.Trim()
                    });
                }
            }
            else
            {
                _dbContext.Occupants.Add(new Occupant
                {
                    PropertyId = command.PropertyId,
                    CustomerId = customer.Id,
                    StayId = stay.Id,
                    FullName = customer.FullName,
                    NationalityCode = customer.IsPassport ? "USA" : "THA",
                    IdentityNumber = customer.NationalIdOrPassport,
                    IsPrimaryOccupant = true
                });
            }

            _dbContext.SaveChanges();
            tx?.Commit();

            var unitRef = BuildSingleUnitRef(unit);
            return Result<StaySummaryDto>.Success(new StaySummaryDto(
                Id: stay.Id,
                DocumentNumber: stay.DocumentNumber,
                StayMode: stay.StayMode.ToString(),
                Status: stay.Status.ToString(),
                Unit: unitRef,
                Customer: new CustomerRefDto(
                    customer.Id,
                    customer.FullName,
                    customer.GetMaskedIdentity())));
        }
        catch (DomainRuleException ex)
        {
            return Result<StaySummaryDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (IsExclusionViolation(ex))
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Unit {unit.UnitNumber} already has an overlapping active stay."));
        }
    }

    public Result<StayListResponse> GetAdminStays(
        Guid propertyId,
        string? status,
        string? stayMode,
        bool unmaskPii = false,
        DateTimeOffset? nowUtc = null)
    {
        StayStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<StayStatus>(status, ignoreCase: true, out var parsedStatus))
            {
                return Result<StayListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid StayStatus '{status}'."));
            }

            statusFilter = parsedStatus;
        }

        StayMode? modeFilter = null;
        if (!string.IsNullOrWhiteSpace(stayMode))
        {
            if (!Enum.TryParse<StayMode>(stayMode, ignoreCase: true, out var parsedMode)
                || parsedMode == StayMode.Monthly)
            {
                return Result<StayListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Invalid StayMode '{stayMode}' for Stay."));
            }

            modeFilter = parsedMode;
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<StayListResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        var query = _dbContext.Stays
            .AsNoTracking()
            .Where(s => s.PropertyId == propertyId);

        if (statusFilter.HasValue)
        {
            query = query.Where(s => s.Status == statusFilter.Value);
        }

        if (modeFilter.HasValue)
        {
            query = query.Where(s => s.StayMode == modeFilter.Value);
        }

        var stays = query
            .OrderByDescending(s => s.CheckInAt)
            .ThenByDescending(s => s.DocumentNumber)
            .ToList();

        var items = stays
            .Select(s => MapStayDetailDto(s, clockUtc, unmaskPii))
            .ToList();

        return Result<StayListResponse>.Success(new StayListResponse(items));
    }

    public Result<StayDetailDto> ExtendAdminStay(
        Guid propertyId,
        Guid stayId,
        ExtendStayRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (request.AdditionalHours <= 0)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "AdditionalHours must be greater than zero."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var stay = _dbContext.Stays
            .FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
        if (stay is null)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Stay '{stayId}' was not found in property '{propertyId}'."));
        }

        if (stay.Status != StayStatus.Active)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Cannot extend stay {stay.DocumentNumber} when status is {stay.Status}."));
        }

        var unit = _dbContext.Units
            .AsNoTracking()
            .First(u => u.Id == stay.UnitId);
        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .First(ut => ut.Id == unit.UnitTypeId);
        var ratePlan = FindActiveRatePlan(propertyId, unit.UnitTypeId);
        var turnaroundBufferMinutes = ratePlan?.TurnaroundBufferMinutes ?? 30;

        var oldExpectedEnd = stay.ExpectedCheckOutAt ?? stay.CheckInAt.AddHours(3);
        var proposedEnd = oldExpectedEnd.AddHours(request.AdditionalHours);
        var proposedEffectiveEnd = stay.StayMode == StayMode.Hourly
            ? proposedEnd.AddMinutes(turnaroundBufferMinutes)
            : proposedEnd;

        ExpireStaleHolds(propertyId, clockUtc);

        var unitReservations = _dbContext.Reservations
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId && r.UnitId == unit.Id && r.Id != stay.ReservationId)
            .ToList();

        var collidesWithReservation = unitReservations.Any(r =>
            r.BlocksInventory(clockUtc)
            && UnifiedAvailabilityCalculator.IntervalsOverlap(
                oldExpectedEnd,
                proposedEffectiveEnd,
                r.SlotStartAt,
                r.GetEffectiveBlockedEndAt(turnaroundBufferMinutes)));

        if (collidesWithReservation)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Cannot extend stay {stay.DocumentNumber}: Unit {unit.UnitNumber} has an upcoming reservation."));
        }

        var folio = EnsureTrackedFolio(stay);
        var existingChargeIds = folio.Charges.Select(c => c.Id).ToHashSet();

        try
        {
            if (stay.StayMode == StayMode.Hourly)
            {
                var hourlyRule = ratePlan?.ToHourlyRateRule() ?? new HourlyRateRule(
                    BasePackageHours: Math.Max(1, unitType.HourlyBasePackageHours),
                    BasePackagePrice: unitType.HourlyBasePackagePrice,
                    AdditionalHourPrice: unitType.HourlyAdditionalHourPrice,
                    GracePeriodMinutes: 15,
                    AutoCapToDailyRate: unitType.DailyRate,
                    TurnaroundBufferMinutes: 30);

                var oldDurationMins = Math.Max(60, (int)Math.Ceiling((oldExpectedEnd - stay.CheckInAt).TotalMinutes));
                var oldQuote = HourlyPricingCalculator.Calculate(oldDurationMins, hourlyRule);

                stay.ExtendStay(request.AdditionalHours);

                var newDurationMins = Math.Max(60, (int)Math.Ceiling((stay.ExpectedCheckOutAt!.Value - stay.CheckInAt).TotalMinutes));
                var newQuote = HourlyPricingCalculator.Calculate(newDurationMins, hourlyRule);

                var deltaCharge = Math.Max(0m, newQuote.FinalHourlyRoomCharge - oldQuote.FinalHourlyRoomCharge);
                if (deltaCharge > 0m)
                {
                    var capSuffixTh = newQuote.IsCappedToDailyRate ? " (ปัดเพดานรายวัน)" : string.Empty;
                    var capSuffixEn = newQuote.IsCappedToDailyRate ? " (Auto-capped to Daily Rate)" : string.Empty;
                    folio.AddCharge(
                        $"ค่าต่อเวลาเข้าพัก +{request.AdditionalHours} ชม.{capSuffixTh}",
                        deltaCharge,
                        TaxMode.VatIncluded,
                        $"Stay Extension +{request.AdditionalHours}h{capSuffixEn}",
                        UtilityChargeCategories.ShortStayRoom);
                }
            }
            else
            {
                stay.ExtendStay(request.AdditionalHours);
                var nightlyRate = ratePlan?.WeekdayRate ?? unitType.DailyRate;
                var additionalCharge = request.AdditionalHours >= 24
                    ? decimal.Round((request.AdditionalHours / 24m) * nightlyRate, 2, MidpointRounding.AwayFromZero)
                    : Math.Min(nightlyRate, decimal.Round(request.AdditionalHours * (ratePlan?.AdditionalHourPrice ?? unitType.HourlyAdditionalHourPrice), 2, MidpointRounding.AwayFromZero));

                if (additionalCharge > 0m)
                {
                    folio.AddCharge(
                        $"ค่าต่อเวลาเช็คเอาต์ +{request.AdditionalHours} ชม.",
                        additionalCharge,
                        TaxMode.VatIncluded,
                        $"Late Check-out / Extension +{request.AdditionalHours}h",
                        UtilityChargeCategories.ShortStayRoom);
                }
            }

            foreach (var addedCharge in folio.Charges.Where(c => !existingChargeIds.Contains(c.Id)))
            {
                _dbContext.Set<FolioCharge>().Add(addedCharge);
            }

            _dbContext.SaveChanges();
            return Result<StayDetailDto>.Success(MapStayDetailDto(stay, clockUtc, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (IsExclusionViolation(ex))
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Cannot extend stay {stay.DocumentNumber}: overlapping stay window detected."));
        }
    }

    public Result<StayDetailDto> AddAdminFolioCharge(
        Guid propertyId,
        Guid stayId,
        AddFolioChargeRequest request,
        DateTimeOffset? nowUtc = null)
    {
        if (request.Amount <= 0m)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Folio charge Amount must be greater than zero."));
        }

        if (!Enum.TryParse<TaxMode>(request.TaxMode, ignoreCase: true, out var parsedTaxMode))
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Invalid TaxMode '{request.TaxMode}'."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var stay = _dbContext.Stays
            .FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
        if (stay is null)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Stay '{stayId}' was not found in property '{propertyId}'."));
        }

        if (stay.Status != StayStatus.Active)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Cannot add charge to stay {stay.DocumentNumber} when status is {stay.Status}."));
        }

        try
        {
            var folio = EnsureTrackedFolio(stay);
            var existingChargeIds = folio.Charges.Select(c => c.Id).ToHashSet();

            folio.AddCharge(
                LocalizedText.Create(request.Description.Th, request.Description.En),
                request.Amount,
                parsedTaxMode);

            foreach (var addedCharge in folio.Charges.Where(c => !existingChargeIds.Contains(c.Id)))
            {
                _dbContext.Set<FolioCharge>().Add(addedCharge);
            }

            _dbContext.SaveChanges();
            return Result<StayDetailDto>.Success(MapStayDetailDto(stay, clockUtc, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<StayDetailDto> RecordAdminFolioPayment(
        Guid propertyId,
        Guid stayId,
        RecordFolioPaymentRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null)
    {
        if (request.Amount <= 0m)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Payment Amount must be greater than zero."));
        }

        if (request.PaymentMethod is not ("Cash" or "BankTransfer" or "PromptPay"))
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Invalid PaymentMethod '{request.PaymentMethod}'."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var stay = _dbContext.Stays
            .FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
        if (stay is null)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Stay '{stayId}' was not found in property '{propertyId}'."));
        }

        var folio = EnsureTrackedFolio(stay);
        var roundedAmount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero);
        if (roundedAmount > folio.BalanceDue)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Payment amount ({roundedAmount:0.00}) cannot exceed Folio balance due ({folio.BalanceDue:0.00})."));
        }

        var property = _dbContext.Properties
            .AsNoTracking()
            .First(p => p.Id == propertyId);
        _ = _documentNumberService.NextDocumentNumberAsync(
            property.Id,
            property.Code,
            DocumentTypeCode.RCT,
            clockUtc).GetAwaiter().GetResult();

        folio.RecordPayment(roundedAmount);
        if (request.PaymentMethod == "Cash")
        {
            // Cash lands in the caller's Open drawer; transfers/PromptPay do not touch the shift.
            FindTrackedOpenShift(propertyId, cashierUserId)?.RecordCashReceipt(roundedAmount);
        }
        _dbContext.SaveChanges();

        return Result<StayDetailDto>.Success(MapStayDetailDto(stay, clockUtc, unmaskPii: false));
    }

    public Result<StayDetailDto> CheckOutAdminStay(
        Guid propertyId,
        Guid stayId,
        CheckOutStayRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null)
    {
        if (request.KeyDepositDeductionAmount < 0m)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "KeyDepositDeductionAmount cannot be negative."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        using var tx = BeginTransactionIfNeeded();

        var stay = _dbContext.Stays
            .FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
        if (stay is null)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Stay '{stayId}' was not found in property '{propertyId}'."));
        }

        if (stay.Status != StayStatus.Active)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Stay {stay.DocumentNumber} is already in status {stay.Status}."));
        }

        var folio = EnsureTrackedFolio(stay);
        if (folio.BalanceDue != 0.00m)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.StayFolioUnsettled,
                $"Stay {stay.DocumentNumber} cannot be checked out while Folio balance due is {folio.BalanceDue:0.00}."));
        }

        var ledger = _dbContext.DepositLedgers
            .Include(l => l.Transactions)
            .FirstOrDefault(l => l.StayId == stay.Id && l.DepositType == DepositType.KeyDeposit);

        var existingTxIds = ledger?.Transactions.Select(t => t.Id).ToHashSet() ?? [];

        try
        {
            if (ledger is not null && ledger.CurrentBalance > 0m)
            {
                var property = _dbContext.Properties
                    .AsNoTracking()
                    .First(p => p.Id == propertyId);
                var reason = string.IsNullOrWhiteSpace(request.DeductionOrRefundReason)
                    ? "Keycard returned at check-out"
                    : request.DeductionOrRefundReason.Trim();

                if (request.KeyDepositDeductionAmount > 0m)
                {
                    var deductDocNo = _documentNumberService.NextDocumentNumberAsync(
                        property.Id,
                        property.Code,
                        DocumentTypeCode.DEP,
                        clockUtc).GetAwaiter().GetResult();
                    ledger.RecordDeduction(deductDocNo, request.KeyDepositDeductionAmount, reason);
                }

                if (ledger.CurrentBalance > 0m)
                {
                    var refundDocNo = _documentNumberService.NextDocumentNumberAsync(
                        property.Id,
                        property.Code,
                        DocumentTypeCode.DEP,
                        clockUtc).GetAwaiter().GetResult();
                    ledger.RefundRemainingBalance(refundDocNo, reason, FindTrackedOpenShift(propertyId, cashierUserId));
                }

                foreach (var newTx in ledger.Transactions.Where(t => !existingTxIds.Contains(t.Id)))
                {
                    _dbContext.DepositTransactions.Add(newTx);
                }
            }

            stay.CompleteCheckOut(folio, ledger, clockUtc);

            var unit = _dbContext.Units.First(u => u.Id == stay.UnitId);
            var housekeepingTask = unit.MarkCheckedOutOrMovedOut(stay.DocumentNumber);
            _dbContext.HousekeepingTasks.Add(housekeepingTask);

            _dbContext.SaveChanges();
            tx?.Commit();

            return Result<StayDetailDto>.Success(MapStayDetailDto(stay, clockUtc, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<RegulatoryExportResponse> GetAdminRegulatoryExport(
        Guid propertyId,
        string reportType,
        bool unmaskPii,
        DateTimeOffset? nowUtc = null)
    {
        var normalizedType = reportType?.Trim().ToUpperInvariant() ?? string.Empty;
        if (normalizedType is not ("RR4" or "TM30"))
        {
            return Result<RegulatoryExportResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "ReportType must be 'RR4' or 'TM30'."));
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;

        var property = _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefault(p => p.Id == propertyId);
        if (property is null)
        {
            return Result<RegulatoryExportResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        var filteredOccupants = _dbContext.Occupants
            .AsNoTracking()
            .Where(o => o.PropertyId == propertyId)
            .ToList()
            .Where(o => normalizedType == "RR4" || o.IsForeignNational)
            .ToList();

        var staysById = _dbContext.Stays
            .AsNoTracking()
            .Where(s => s.PropertyId == propertyId)
            .ToDictionary(s => s.Id);

        var leasesById = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId)
            .ToDictionary(l => l.Id);

        var unitsById = _dbContext.Units
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId)
            .ToDictionary(u => u.Id);

        var rows = new List<RegulatoryGuestRowDto>();
        foreach (var occ in filteredOccupants)
        {
            string sourceDoc = "N/A";
            string unitNumber = "-";
            DateTimeOffset checkInAt = clockUtc;
            DateTimeOffset? checkOutAt = null;
            string mode = StayMode.Daily.ToString();

            if (occ.StayId.HasValue && staysById.TryGetValue(occ.StayId.Value, out var stay))
            {
                sourceDoc = stay.DocumentNumber;
                unitNumber = unitsById.TryGetValue(stay.UnitId, out var u) ? u.UnitNumber : "-";
                checkInAt = stay.CheckInAt;
                checkOutAt = stay.CheckOutAt;
                mode = stay.StayMode.ToString();
            }
            else if (occ.LeaseId.HasValue && leasesById.TryGetValue(occ.LeaseId.Value, out var lease))
            {
                sourceDoc = lease.DocumentNumber;
                unitNumber = unitsById.TryGetValue(lease.UnitId, out var u) ? u.UnitNumber : "-";
                checkInAt = new DateTimeOffset(lease.StartDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
                mode = StayMode.Monthly.ToString();
            }

            rows.Add(new RegulatoryGuestRowDto(
                OccupantId: occ.Id,
                SourceDocumentNumber: sourceDoc,
                UnitNumber: unitNumber,
                FullName: occ.FullName,
                NationalityCode: occ.NationalityCode,
                IdentityNumber: unmaskPii ? occ.IdentityNumber : occ.GetMaskedIdentity(),
                IsPrimaryOccupant: occ.IsPrimaryOccupant,
                VehicleLicensePlate: occ.VehicleLicensePlate,
                CheckInAt: checkInAt,
                CheckOutAt: checkOutAt,
                StayMode: mode));
        }

        var orderedRows = rows.OrderByDescending(r => r.CheckInAt).ToList();
        var csv = new StringBuilder();
        csv.AppendLine("ReportType,PropertyCode,DocumentNumber,UnitNumber,FullName,NationalityCode,IdentityNumber,IsPrimaryOccupant,VehicleLicensePlate,StayMode,CheckInAt,CheckOutAt");
        foreach (var row in orderedRows)
        {
            csv.AppendLine($"{normalizedType},{property.Code},{row.SourceDocumentNumber},{row.UnitNumber},\"{row.FullName}\",{row.NationalityCode},{row.IdentityNumber},{row.IsPrimaryOccupant},{row.VehicleLicensePlate ?? string.Empty},{row.StayMode},{row.CheckInAt:O},{row.CheckOutAt?.ToString("O") ?? string.Empty}");
        }

        return Result<RegulatoryExportResponse>.Success(new RegulatoryExportResponse(
            Property: new PropertyRefDto(
                property.Id,
                property.Code,
                LocalizedTextDto.FromDomain(property.Name)),
            ReportType: normalizedType,
            GeneratedAt: clockUtc,
            IsPiiUnmasked: unmaskPii,
            CsvContent: csv.ToString(),
            Rows: orderedRows));
    }

    public Result<ClientDashboardResponse> GetClientDashboard(Guid customerId)
    {
        var customer = _dbContext.Customers
            .AsNoTracking()
            .FirstOrDefault(c => c.Id == customerId)
            ?? new Customer
            {
                Id = customerId,
                FullName = "Client Tenant",
                NationalIdOrPassport = "1100509999123"
            };

        var customerDto = new CustomerRefDto(
            customer.Id,
            customer.FullName,
            customer.GetMaskedIdentity());

        var clockUtc = DateTimeOffset.UtcNow;
        ExpireStaleHolds(null, clockUtc);

        var customerHolds = _dbContext.Reservations
            .AsNoTracking()
            .Where(r => r.CustomerId == customerId && r.Status == ReservationStatus.Hold)
            .OrderByDescending(r => r.HoldExpiresAt)
            .ToList()
            .Where(r => !r.IsHoldExpired(clockUtc))
            .ToList();

        ClientHoldReservationDto? holdDto = null;
        if (customerHolds.Count > 0)
        {
            var topHold = customerHolds[0];
            var ut = _dbContext.UnitTypes
                .AsNoTracking()
                .FirstOrDefault(x => x.Id == topHold.UnitTypeId);
            var utName = ut is not null
                ? LocalizedTextDto.FromDomain(ut.Name)
                : new LocalizedTextDto("มาตรฐาน 24 ตร.ม.", "Standard 24 sqm");

            holdDto = new ClientHoldReservationDto(
                topHold.DocumentNumber,
                utName,
                topHold.StayMode.ToString(),
                topHold.HoldExpiresAt,
                topHold.DepositAmount);
        }

        var activeLeaseEntity = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.CustomerId == customerId)
            .ToList()
            .FirstOrDefault(l => l.BlocksUnitAvailability);

        ClientActiveLeaseDto? leaseDto = null;
        if (activeLeaseEntity is not null)
        {
            var unit = _dbContext.Units
                .AsNoTracking()
                .First(u => u.Id == activeLeaseEntity.UnitId);
            leaseDto = new ClientActiveLeaseDto(
                activeLeaseEntity.DocumentNumber,
                BuildSingleUnitRef(unit),
                activeLeaseEntity.MonthlyRentAmount,
                activeLeaseEntity.SecurityDepositAmount);
        }

        var unpaidInvoices = _dbContext.Invoices
            .AsNoTracking()
            .Include(i => i.Lines)
            .Where(i => i.CustomerId == customerId
                && (i.Status == InvoiceStatus.Issued
                    || i.Status == InvoiceStatus.Overdue
                    || i.Status == InvoiceStatus.PartiallyPaid))
            .AsEnumerable()
            .Select(i => new ClientUnpaidInvoiceDto(
                i.Id,
                i.DocumentNumber,
                i.TotalAmount,
                i.Status.ToString()))
            .ToList();

        var pendingParcels = _dbContext.Parcels
            .AsNoTracking()
            .Where(p => p.CustomerId == customerId && p.Status == ParcelStatus.Arrived)
            .Select(p => new ClientPendingParcelDto(
                p.Id,
                p.DocumentNumber,
                p.CarrierName,
                p.ArrivedAt))
            .ToList();

        return Result<ClientDashboardResponse>.Success(new ClientDashboardResponse(
            Customer: customerDto,
            ActiveHoldReservation: holdDto,
            ActiveLease: leaseDto,
            UnpaidInvoices: unpaidInvoices,
            PendingParcels: pendingParcels));
    }

    private Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? BeginTransactionIfNeeded() =>
        _dbContext.Database.CurrentTransaction is null
            ? _dbContext.Database.BeginTransaction()
            : null;

    private void LockUnitTypeRow(Guid unitTypeId)
    {
        if (_dbContext.Database.IsRelational())
        {
            _dbContext.Database.ExecuteSqlInterpolated(
                $"SELECT 1 FROM \"UnitTypes\" WHERE \"Id\" = {unitTypeId} FOR UPDATE");
        }
    }

    private void LockUnitRow(Guid unitId)
    {
        if (_dbContext.Database.IsRelational())
        {
            _dbContext.Database.ExecuteSqlInterpolated(
                $"SELECT 1 FROM \"Units\" WHERE \"Id\" = {unitId} FOR UPDATE");
        }
    }

    private static bool IsExclusionViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: "23P01" };

    private void ExpireStaleHolds(Guid? propertyId, DateTimeOffset clockUtc)
    {
        var holdsQuery = _dbContext.Reservations.Where(r => r.Status == ReservationStatus.Hold);
        if (propertyId.HasValue)
        {
            holdsQuery = holdsQuery.Where(r => r.PropertyId == propertyId.Value);
        }

        var holds = holdsQuery.ToList();
        foreach (var hold in holds)
        {
            hold.ExpireHoldIfPastDue(clockUtc);
        }

        if (_dbContext.ChangeTracker.HasChanges())
        {
            _dbContext.SaveChanges();
        }
    }

    private RatePlan? FindActiveRatePlan(Guid propertyId, Guid unitTypeId) =>
        _dbContext.RatePlans
            .AsNoTracking()
            .FirstOrDefault(rp => rp.PropertyId == propertyId && rp.UnitTypeId == unitTypeId && rp.IsActive);

    private UnitTypeAvailabilityResult EvaluateUnitTypeAvailabilityFromDb(
        Guid propertyId,
        UnitType unitType,
        StayMode requestedStayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        DateTimeOffset clockUtc,
        int turnaroundBufferMinutes,
        Guid? ignoreReservationId = null)
    {
        var unitsOfUnitType = _dbContext.Units
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId && u.UnitTypeId == unitType.Id)
            .ToList();

        var leases = _dbContext.Leases
            .AsNoTracking()
            .Where(l => l.PropertyId == propertyId)
            .ToList();

        var stays = _dbContext.Stays
            .AsNoTracking()
            .Where(s => s.PropertyId == propertyId)
            .ToList();

        var reservations = _dbContext.Reservations
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId)
            .ToList();

        return UnifiedAvailabilityCalculator.EvaluateUnitTypeAvailability(
            unitType: unitType,
            unitsOfUnitType: unitsOfUnitType,
            propertyLeases: leases,
            propertyStays: stays,
            propertyReservations: reservations,
            requestedStayMode: requestedStayMode,
            slotStartAt: slotStartAt,
            slotEndAt: slotEndAt,
            nowUtc: clockUtc,
            turnaroundBufferMinutes: turnaroundBufferMinutes,
            ignoreReservationId: ignoreReservationId);
    }

    private Customer EnsureCustomerExists(
        Guid customerId,
        string fallbackName = "Guest Customer",
        string fallbackIdentity = "1100501234999")
    {
        var customer = _dbContext.Customers.FirstOrDefault(c => c.Id == customerId);
        if (customer is not null)
        {
            return customer;
        }

        customer = new Customer
        {
            Id = customerId,
            FullName = fallbackName,
            NationalIdOrPassport = fallbackIdentity
        };
        _dbContext.Customers.Add(customer);
        _dbContext.SaveChanges();
        return customer;
    }

    private Folio EnsureTrackedFolio(Stay stay)
    {
        var folio = _dbContext.Folios
            .Include(f => f.Charges)
            .FirstOrDefault(f => f.StayId == stay.Id);
        if (folio is not null)
        {
            return folio;
        }

        folio = new Folio
        {
            PropertyId = stay.PropertyId,
            StayId = stay.Id
        };
        _dbContext.Folios.Add(folio);
        _dbContext.SaveChanges();
        return folio;
    }

    private IReadOnlyList<ReservationItemDto> MapReservationItems(IReadOnlyList<Reservation> reservations)
    {
        if (reservations.Count == 0)
        {
            return [];
        }

        var propertyIds = reservations.Select(r => r.PropertyId).Distinct().ToList();
        var unitTypeIds = reservations.Select(r => r.UnitTypeId).Distinct().ToList();
        var customerIds = reservations.Select(r => r.CustomerId).Distinct().ToList();
        var unitIds = reservations.Where(r => r.UnitId.HasValue).Select(r => r.UnitId!.Value).Distinct().ToList();

        var propertiesById = _dbContext.Properties
            .AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .ToDictionary(p => p.Id);

        var unitTypesById = _dbContext.UnitTypes
            .AsNoTracking()
            .Where(ut => unitTypeIds.Contains(ut.Id))
            .ToDictionary(ut => ut.Id);

        var customersById = _dbContext.Customers
            .AsNoTracking()
            .Where(c => customerIds.Contains(c.Id))
            .ToDictionary(c => c.Id);

        var activeRatePlans = _dbContext.RatePlans
            .AsNoTracking()
            .Where(rp => propertyIds.Contains(rp.PropertyId) && rp.IsActive)
            .ToList();

        var unitRefsById = new Dictionary<Guid, UnitRefDto>();
        if (unitIds.Count > 0)
        {
            var units = _dbContext.Units
                .AsNoTracking()
                .Where(u => unitIds.Contains(u.Id))
                .ToList();
            foreach (var unit in units)
            {
                unitRefsById[unit.Id] = BuildSingleUnitRef(unit);
            }
        }

        var list = new List<ReservationItemDto>(reservations.Count);
        foreach (var reservation in reservations)
        {
            var property = propertiesById[reservation.PropertyId];
            var unitType = unitTypesById[reservation.UnitTypeId];
            var customer = customersById.TryGetValue(reservation.CustomerId, out var c)
                ? c
                : EnsureCustomerExists(reservation.CustomerId);
            var ratePlan = activeRatePlans.FirstOrDefault(rp =>
                rp.PropertyId == reservation.PropertyId && rp.UnitTypeId == reservation.UnitTypeId);
            var turnaroundBufferMinutes = ratePlan?.TurnaroundBufferMinutes ?? 30;

            UnitRefDto? assignedUnit = null;
            if (reservation.UnitId.HasValue && unitRefsById.TryGetValue(reservation.UnitId.Value, out var uRef))
            {
                assignedUnit = uRef;
            }

            list.Add(new ReservationItemDto(
                Id: reservation.Id,
                DocumentNumber: reservation.DocumentNumber,
                Property: new PropertyRefDto(
                    property.Id,
                    property.Code,
                    LocalizedTextDto.FromDomain(property.Name)),
                Customer: new CustomerRefDto(
                    customer.Id,
                    customer.FullName,
                    customer.GetMaskedIdentity()),
                UnitType: new UnitTypeRefDto(
                    unitType.Id,
                    unitType.Code,
                    LocalizedTextDto.FromDomain(unitType.Name),
                    unitType.AreaSqm),
                AssignedUnit: assignedUnit,
                StayMode: reservation.StayMode.ToString(),
                SlotStartAt: reservation.SlotStartAt,
                SlotEndAt: reservation.SlotEndAt,
                EffectiveBlockedEndAt: reservation.GetEffectiveBlockedEndAt(turnaroundBufferMinutes),
                HoldExpiresAt: reservation.HoldExpiresAt,
                DepositAmount: reservation.DepositAmount,
                PaymentSlipFileKey: reservation.PaymentSlipFileKey,
                CancellationReason: reservation.CancellationReason,
                Status: reservation.Status.ToString()));
        }

        return list;
    }

    private StayDetailDto MapStayDetailDto(Stay stay, DateTimeOffset clockUtc, bool unmaskPii)
    {
        var property = _dbContext.Properties
            .AsNoTracking()
            .First(p => p.Id == stay.PropertyId);
        var customer = _dbContext.Customers
            .AsNoTracking()
            .FirstOrDefault(c => c.Id == stay.CustomerId)
            ?? EnsureCustomerExists(stay.CustomerId);
        var unit = _dbContext.Units
            .AsNoTracking()
            .First(u => u.Id == stay.UnitId);
        var ratePlan = FindActiveRatePlan(stay.PropertyId, unit.UnitTypeId);
        var graceMinutes = ratePlan?.GracePeriodMinutes ?? 15;

        var folio = _dbContext.Folios
            .AsNoTracking()
            .Include(f => f.Charges)
            .FirstOrDefault(f => f.StayId == stay.Id)
            ?? EnsureTrackedFolio(stay);

        var folioDto = new FolioSummaryDto(
            Id: folio.Id,
            Charges: folio.Charges.Select(c => new FolioChargeItemDto(
                c.Id,
                LocalizedTextDto.FromDomain(c.Description),
                c.Amount,
                c.TaxMode.ToString())).ToList(),
            TotalCharges: folio.TotalCharges,
            TotalPayments: folio.TotalPayments,
            BalanceDue: folio.BalanceDue);

        var ledger = _dbContext.DepositLedgers
            .AsNoTracking()
            .Include(l => l.Transactions)
            .FirstOrDefault(l => l.StayId == stay.Id && l.DepositType == DepositType.KeyDeposit);

        var occupants = _dbContext.Occupants
            .AsNoTracking()
            .Where(o => o.StayId == stay.Id)
            .ToList()
            .Select(o => new StayOccupantDto(
                Id: o.Id,
                FullName: o.FullName,
                NationalityCode: o.NationalityCode,
                MaskedIdentityNumber: unmaskPii ? o.IdentityNumber : o.GetMaskedIdentity(),
                IsPrimaryOccupant: o.IsPrimaryOccupant,
                VehicleLicensePlate: o.VehicleLicensePlate))
            .ToList();

        var reservationDocNo = stay.ReservationId.HasValue
            ? _dbContext.Reservations
                .AsNoTracking()
                .FirstOrDefault(r => r.Id == stay.ReservationId.Value)?.DocumentNumber
            : null;

        var hkTask = _dbContext.HousekeepingTasks
            .AsNoTracking()
            .Where(t => t.PropertyId == stay.PropertyId && t.SourceDocumentNumber == stay.DocumentNumber)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefault();

        return new StayDetailDto(
            Id: stay.Id,
            DocumentNumber: stay.DocumentNumber,
            Property: new PropertyRefDto(
                property.Id,
                property.Code,
                LocalizedTextDto.FromDomain(property.Name)),
            Unit: BuildSingleUnitRef(unit),
            Customer: new CustomerRefDto(
                customer.Id,
                customer.FullName,
                unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
            ReservationDocumentNumber: reservationDocNo,
            StayMode: stay.StayMode.ToString(),
            Status: stay.Status.ToString(),
            CheckInAt: stay.CheckInAt,
            ExpectedCheckOutAt: stay.ExpectedCheckOutAt,
            CheckOutAt: stay.CheckOutAt,
            RemainingMinutes: stay.GetRemainingMinutes(clockUtc),
            IsOvertime: stay.IsOvertime(clockUtc, graceMinutes),
            KeyDepositAmount: stay.KeyDepositAmount,
            KeyDepositBalance: ledger?.CurrentBalance ?? 0m,
            Folio: folioDto,
            Occupants: occupants,
            GeneratedHousekeepingTaskStatus: hkTask?.Status.ToString());
    }

    private Dictionary<Guid, UnitRefDto> BuildUnitRefsForProperty(Guid propertyId, IReadOnlyList<Unit> units)
    {
        var buildingsById = _dbContext.Buildings
            .AsNoTracking()
            .Where(b => b.PropertyId == propertyId)
            .ToDictionary(b => b.Id);

        var floorsById = _dbContext.Floors
            .AsNoTracking()
            .Where(f => f.PropertyId == propertyId)
            .ToDictionary(f => f.Id);

        var unitTypesById = _dbContext.UnitTypes
            .AsNoTracking()
            .Where(ut => ut.PropertyId == propertyId)
            .ToDictionary(ut => ut.Id);

        var dict = new Dictionary<Guid, UnitRefDto>(units.Count);
        foreach (var u in units)
        {
            var bName = buildingsById.TryGetValue(u.BuildingId, out var b)
                ? LocalizedTextDto.FromDomain(b.Name)
                : new LocalizedTextDto("ไม่ระบุอาคาร", "Unknown Building");
            var fNum = floorsById.TryGetValue(u.FloorId, out var f) ? f.FloorNumber : 0;
            var utName = unitTypesById.TryGetValue(u.UnitTypeId, out var ut)
                ? LocalizedTextDto.FromDomain(ut.Name)
                : new LocalizedTextDto("ไม่ระบุประเภท", "Unknown Type");

            dict[u.Id] = new UnitRefDto(u.Id, u.UnitNumber, bName, fNum, utName);
        }

        return dict;
    }

    private UnitRefDto BuildSingleUnitRef(Unit unit)
    {
        var building = _dbContext.Buildings
            .AsNoTracking()
            .FirstOrDefault(b => b.Id == unit.BuildingId);
        var floor = _dbContext.Floors
            .AsNoTracking()
            .FirstOrDefault(f => f.Id == unit.FloorId);
        var unitType = _dbContext.UnitTypes
            .AsNoTracking()
            .FirstOrDefault(ut => ut.Id == unit.UnitTypeId);

        return new UnitRefDto(
            unit.Id,
            unit.UnitNumber,
            building is not null
                ? LocalizedTextDto.FromDomain(building.Name)
                : new LocalizedTextDto("ไม่ระบุอาคาร", "Unknown Building"),
            floor?.FloorNumber ?? 0,
            unitType is not null
                ? LocalizedTextDto.FromDomain(unitType.Name)
                : new LocalizedTextDto("ไม่ระบุประเภท", "Unknown Type"));
    }

    private static UnitMasterItemDto MapUnitMasterItem(
        Unit u,
        IReadOnlyDictionary<Guid, Building> buildingsById,
        IReadOnlyDictionary<Guid, Floor> floorsById,
        IReadOnlyDictionary<Guid, UnitType> unitTypesById)
    {
        var building = buildingsById.TryGetValue(u.BuildingId, out var b)
            ? new BuildingRefDto(b.Id, b.Code, LocalizedTextDto.FromDomain(b.Name))
            : new BuildingRefDto(u.BuildingId, "UNKNOWN", new LocalizedTextDto("ไม่ระบุอาคาร", "Unknown Building"));

        var floor = floorsById.TryGetValue(u.FloorId, out var f)
            ? new FloorRefDto(f.Id, f.FloorNumber, LocalizedTextDto.FromDomain(f.Name))
            : new FloorRefDto(u.FloorId, 0, new LocalizedTextDto("ไม่ระบุชั้น", "Unknown Floor"));

        var unitType = unitTypesById.TryGetValue(u.UnitTypeId, out var ut)
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

    private static RatePlanItemDto MapRatePlanDto(
        RatePlan plan,
        IReadOnlyDictionary<Guid, UnitType> unitTypesById)
    {
        var unitType = unitTypesById.TryGetValue(plan.UnitTypeId, out var ut)
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

    private static AdminUserDto MapAdminUserDto(
        AdminUser user,
        IReadOnlyDictionary<Guid, Property> propertiesById)
    {
        var allowedProps = user.AllowedPropertyIds
            .Where(propertiesById.ContainsKey)
            .Select(id =>
            {
                var p = propertiesById[id];
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

    private static (decimal EstimatedRoomRate, decimal EstimatedDepositAmount) ComputeEstimatedQuote(
        UnitType unitType,
        RatePlan? ratePlan,
        StayMode stayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt)
    {
        decimal roomRate;
        decimal depositAmount;

        if (stayMode == StayMode.Hourly)
        {
            var durationMinutes = Math.Max(60, (int)Math.Ceiling((slotEndAt - slotStartAt).TotalMinutes));
            if (ratePlan is not null)
            {
                var quote = HourlyPricingCalculator.Calculate(durationMinutes, ratePlan.ToHourlyRateRule());
                roomRate = quote.FinalHourlyRoomCharge;
            }
            else
            {
                roomRate = unitType.HourlyBasePackagePrice;
            }

            depositAmount = Math.Max(200m, decimal.Round(roomRate * 0.50m, 2, MidpointRounding.AwayFromZero));
        }
        else if (stayMode == StayMode.Daily)
        {
            var nights = Math.Max(1, (int)Math.Ceiling((slotEndAt - slotStartAt).TotalDays));
            var nightlyRate = ratePlan?.WeekdayRate ?? unitType.DailyRate;
            roomRate = decimal.Round(nights * nightlyRate, 2, MidpointRounding.AwayFromZero);
            depositAmount = decimal.Round(roomRate * 0.50m, 2, MidpointRounding.AwayFromZero);
        }
        else
        {
            roomRate = ratePlan?.MonthlyRentRate ?? unitType.MonthlyRentRate;
            depositAmount = roomRate;
        }

        return (roomRate, depositAmount);
    }
}
