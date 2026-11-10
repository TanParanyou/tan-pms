using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class GetAdminStayHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminStayHandler(IStayStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<StayDetailDto> Handle(GetAdminStayQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminStayCheckIn,
            PermissionKeys.AdminStayCheckOut,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminStay(query.PropertyId, query.StayId, unmaskPii);
    }
}
