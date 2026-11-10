using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class GetAdminRatePlanHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminRatePlanHandler(IRateCatalogStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RatePlanItemDto> Handle(GetAdminRatePlanQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminRatesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<RatePlanItemDto>.Failure(authError);
        }

        return _store.GetRatePlan(query.PropertyId, query.RatePlanId);
    }
}
