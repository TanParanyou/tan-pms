using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class GetAdminUsersHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminUsersHandler(IIdentityStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AdminUserListResponse> Handle(GetAdminUsersQuery query)
    {
        var authError = query.PropertyId.HasValue
            ? ScopeAuthorizationGuard.CheckAdminPropertyScope(_currentUser, query.PropertyId.Value, PermissionKeys.AdminUsersRead)
            : ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminUsersRead);

        if (authError is not null)
        {
            return Result<AdminUserListResponse>.Failure(authError);
        }

        return _store.GetAdminUsers(query.PropertyId, _currentUser.AllowedPropertyIds);
    }
}
