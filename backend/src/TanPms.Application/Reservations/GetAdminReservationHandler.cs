using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class GetAdminReservationHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminReservationHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationItemDto> Handle(GetAdminReservationQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminReservationsRead,
            PermissionKeys.AdminReservationsManage) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        return _store.GetAdminReservation(query.PropertyId, query.ReservationId);
    }
}
