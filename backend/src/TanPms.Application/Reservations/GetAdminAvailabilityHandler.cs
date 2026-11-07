using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class GetAdminAvailabilityHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminAvailabilityHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AvailabilitySearchResponse> Handle(GetAdminAvailabilityQuery query)
    {
        if (!_currentUser.IsAdminScope
            || (!_currentUser.Permissions.Contains(PermissionKeys.AdminReservationsRead)
                && !_currentUser.Permissions.Contains(PermissionKeys.AdminReservationsManage)))
        {
            return Result<AvailabilitySearchResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminReservationsRead}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(query.PropertyId))
        {
            return Result<AvailabilitySearchResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{query.PropertyId}'."));
        }

        return _store.SearchAvailability(
            query.PropertyId,
            query.StayMode,
            query.SlotStartAt,
            query.SlotEndAt);
    }
}
