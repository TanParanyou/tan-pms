using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class GetCurrentAdminCashierShiftHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetCurrentAdminCashierShiftHandler(ICashierShiftStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<CurrentCashierShiftResponse> Handle(GetCurrentAdminCashierShiftQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminCashierOperateShift) is { } authError)
        {
            return Result<CurrentCashierShiftResponse>.Failure(authError);
        }

        return _store.GetCurrentAdminCashierShift(query.PropertyId, _currentUser.UserId);
    }
}
