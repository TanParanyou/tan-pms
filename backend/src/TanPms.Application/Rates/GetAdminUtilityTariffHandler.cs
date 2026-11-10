using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class GetAdminUtilityTariffHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminUtilityTariffHandler(IRateCatalogStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<UtilityTariffItemDto> Handle(GetAdminUtilityTariffQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminRatesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<UtilityTariffItemDto>.Failure(authError);
        }

        return _store.GetUtilityTariff(query.PropertyId, query.TariffId);
    }
}
