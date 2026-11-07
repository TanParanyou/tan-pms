using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class GetAdminReservationsHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminReservationsHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationListResponse> Handle(GetAdminReservationsQuery query)
    {
        if (!_currentUser.IsAdminScope
            || (!_currentUser.Permissions.Contains(PermissionKeys.AdminReservationsRead)
                && !_currentUser.Permissions.Contains(PermissionKeys.AdminReservationsManage)))
        {
            return Result<ReservationListResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminReservationsRead}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(query.PropertyId))
        {
            return Result<ReservationListResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{query.PropertyId}'."));
        }

        return _store.GetAdminReservations(query.PropertyId, query.Status, query.StayMode);
    }
}
