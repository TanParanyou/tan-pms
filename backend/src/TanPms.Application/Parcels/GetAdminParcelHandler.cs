using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Parcels;

public sealed class GetAdminParcelHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminParcelHandler(IParcelStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ParcelItemDto> Handle(GetAdminParcelQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminParcelsManage) is { } authError)
        {
            return Result<ParcelItemDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminParcel(query.PropertyId, query.ParcelId, unmaskPii);
    }
}
