using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class GetAdminStaysHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminStaysHandler(IStayStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<StayListResponse> Handle(GetAdminStaysQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminStayCheckIn,
            PermissionKeys.AdminStayCheckOut,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<StayListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminStays(query.PropertyId, query.Status, query.StayMode, unmaskPii, paging: PageRequest.From(query.Page, query.PageSize));
    }
}
