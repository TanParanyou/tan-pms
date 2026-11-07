using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class SimulateAdminRateAndTaxHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public SimulateAdminRateAndTaxHandler(
        IRateCatalogStore store,
        ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RateSimulationResponse> Handle(SimulateAdminRateAndTaxCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminRatesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<RateSimulationResponse>.Failure(authError);
        }

        return _store.SimulateRateAndTax(command.PropertyId, command.Request);
    }
}
