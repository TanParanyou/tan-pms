using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class GetAdminUsersHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminUsersHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AdminUserListResponse> Handle(GetAdminUsersQuery query)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminUsersRead))
        {
            return Result<AdminUserListResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminUsersRead}'."));
        }

        if (query.PropertyId.HasValue && !_currentUser.AllowedPropertyIds.Contains(query.PropertyId.Value))
        {
            return Result<AdminUserListResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{query.PropertyId.Value}'."));
        }

        return _store.GetAdminUsers(query.PropertyId, _currentUser.AllowedPropertyIds);
    }
}
