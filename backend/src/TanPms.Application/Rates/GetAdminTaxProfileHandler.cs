using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class GetAdminTaxProfileHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminTaxProfileHandler(IRateCatalogStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<TaxProfileItemDto> Handle(GetAdminTaxProfileQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminRatesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<TaxProfileItemDto>.Failure(authError);
        }

        return _store.GetTaxProfile(query.PropertyId, query.TaxProfileId);
    }
}
