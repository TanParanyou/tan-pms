using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class GetAdminLeaseIntentsHandler
{
    private readonly ILeaseIntentStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminLeaseIntentsHandler(ILeaseIntentStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<LeaseIntentListResponse> Handle(GetAdminLeaseIntentsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseIntentListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminLeaseIntents(query.PropertyId, query.Status, unmaskPii);
    }
}
