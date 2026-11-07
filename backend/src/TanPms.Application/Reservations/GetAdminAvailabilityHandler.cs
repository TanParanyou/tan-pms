using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class GetAdminAvailabilityHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminAvailabilityHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AvailabilitySearchResponse> Handle(GetAdminAvailabilityQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminReservationsRead,
            PermissionKeys.AdminReservationsManage) is { } authError)
        {
            return Result<AvailabilitySearchResponse>.Failure(authError);
        }

        return _store.SearchAvailability(
            query.PropertyId,
            query.StayMode,
            query.SlotStartAt,
            query.SlotEndAt);
    }
}
