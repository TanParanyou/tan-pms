using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class GetAdminCashierShiftsHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminCashierShiftsHandler(ICashierShiftStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<CashierShiftListResponse> Handle(GetAdminCashierShiftsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminCashierOperateShift,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<CashierShiftListResponse>.Failure(authError);
        }

        return _store.GetAdminCashierShifts(query.PropertyId, query.Status);
    }
}
