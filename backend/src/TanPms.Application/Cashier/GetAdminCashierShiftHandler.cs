using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class GetAdminCashierShiftHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminCashierShiftHandler(ICashierShiftStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<CashierShiftDto> Handle(GetAdminCashierShiftQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminCashierOperateShift,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<CashierShiftDto>.Failure(authError);
        }

        return _store.GetAdminCashierShift(query.PropertyId, query.ShiftId);
    }
}
