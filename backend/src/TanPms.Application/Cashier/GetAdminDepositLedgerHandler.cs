using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class GetAdminDepositLedgerHandler
{
    private readonly IDepositLedgerStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminDepositLedgerHandler(IDepositLedgerStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<DepositLedgerItemDto> Handle(GetAdminDepositLedgerQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminCashierOperateShift,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<DepositLedgerItemDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminDepositLedger(query.PropertyId, query.LedgerId, unmaskPii);
    }
}
