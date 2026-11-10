using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class GetAdminUserHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminUserHandler(IIdentityStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AdminUserDto> Handle(GetAdminUserQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminUsersRead) is { } authError)
        {
            return Result<AdminUserDto>.Failure(authError);
        }

        var user = _store.GetAdminUser(query.UserId);
        if (user.IsFailure || user.Value is null)
        {
            return user;
        }

        // Readers see a user when they share at least one property with them.
        return user.Value.AllowedProperties.Any(p => _currentUser.AllowedPropertyIds.Contains(p.Id))
            ? user
            : Result<AdminUserDto>.Failure(new Error(DomainErrorCodes.PropertyScopeDenied, "Caller does not share a property with this user."));
    }
}
