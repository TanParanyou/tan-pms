using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Parcels;

public sealed class GetAdminParcelsHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminParcelsHandler(IParcelStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ParcelListResponse> Handle(GetAdminParcelsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminParcelsManage) is { } authError)
        {
            return Result<ParcelListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminParcels(query.PropertyId, query.Status, unmaskPii);
    }
}
