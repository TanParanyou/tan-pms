using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Application.Notifications;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Stays;

namespace TanPms.Application.Common.Abstractions;

public interface IPmsOperationalStore
{
    Result<AuthSessionResponse> Login(LoginAuthSessionCommand command);
    Result<AuthSessionResponse> GetCurrentAuthSession(ICurrentUserContext currentUser);
    Result<RoleCatalogResponse> GetRoleCatalog();
    Result<AdminUserListResponse> GetAdminUsers(Guid? propertyId, IReadOnlySet<Guid> callerAllowedPropertyIds);
    Result<AdminUserDto> UpsertAdminUser(UpsertAdminUserCommand command);
    Result<NotificationItemDto> DispatchNotification(DispatchAdminNotificationCommand command);
    Result<NotificationListResponse> GetClientNotifications(Guid customerId);
    Result<PropertyHierarchyResponse> GetPropertyHierarchy(Guid propertyId);
    Result<UnitMasterItemDto> UpsertUnitMaster(Guid propertyId, UpsertUnitMasterRequest request);
    Result<PropertyRateCatalogResponse> GetPropertyRateCatalog(Guid propertyId);
    Result<RatePlanItemDto> UpsertRatePlan(Guid propertyId, UpsertRatePlanRequest request);
    Result<UtilityTariffItemDto> UpsertUtilityTariff(Guid propertyId, UpsertUtilityTariffRequest request);
    Result<TaxProfileItemDto> UpsertTaxProfile(Guid propertyId, UpsertTaxProfileRequest request);
    Result<RateSimulationResponse> SimulateRateAndTax(Guid propertyId, RateSimulationRequest request);
    Result<RoomRackResponse> GetRoomRack(Guid propertyId);
    Result<StaySummaryDto> CheckInStay(
        CheckInStayCommand command,
        bool callerHasOverridePermission);
    Result<ClientDashboardResponse> GetClientDashboard(Guid customerId);
}
