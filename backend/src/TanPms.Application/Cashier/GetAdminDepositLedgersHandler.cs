using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class GetAdminDepositLedgersHandler
{
    private readonly IDepositLedgerStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminDepositLedgersHandler(IDepositLedgerStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<DepositLedgerListResponse> Handle(GetAdminDepositLedgersQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminCashierOperateShift,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<DepositLedgerListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminDepositLedgers(query.PropertyId, query.DepositType, unmaskPii);
    }
}
