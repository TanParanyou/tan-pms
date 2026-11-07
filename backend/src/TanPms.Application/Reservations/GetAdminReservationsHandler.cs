using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class GetAdminReservationsHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminReservationsHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationListResponse> Handle(GetAdminReservationsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminReservationsRead,
            PermissionKeys.AdminReservationsManage) is { } authError)
        {
            return Result<ReservationListResponse>.Failure(authError);
        }

        return _store.GetAdminReservations(query.PropertyId, query.Status, query.StayMode);
    }
}
