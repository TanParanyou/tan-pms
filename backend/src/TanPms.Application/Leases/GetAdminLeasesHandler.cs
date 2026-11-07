using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class GetAdminLeasesHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminLeasesHandler(ILeaseStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<LeaseListResponse> Handle(GetAdminLeasesQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminLeasesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<LeaseListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminLeases(query.PropertyId, query.Status, query.LicensePlate, unmaskPii);
    }
}
