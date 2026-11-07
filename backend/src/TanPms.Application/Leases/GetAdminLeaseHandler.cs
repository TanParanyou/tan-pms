using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class GetAdminLeaseHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminLeaseHandler(ILeaseStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<LeaseItemDto> Handle(GetAdminLeaseQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminLeasesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<LeaseItemDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminLease(query.PropertyId, query.LeaseId, unmaskPii);
    }
}
