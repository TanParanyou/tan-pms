using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class SimulateAdminRateAndTaxHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public SimulateAdminRateAndTaxHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RateSimulationResponse> Handle(SimulateAdminRateAndTaxCommand command)
    {
        var hasAccess = _currentUser.Permissions.Contains(PermissionKeys.AdminRatesManage)
            || _currentUser.Permissions.Contains(PermissionKeys.AdminPropertiesRead);

        if (!_currentUser.IsAdminScope || !hasAccess)
        {
            return Result<RateSimulationResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminRatesManage}' or '{PermissionKeys.AdminPropertiesRead}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<RateSimulationResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
        }

        return _store.SimulateRateAndTax(command.PropertyId, command.Request);
    }
}
