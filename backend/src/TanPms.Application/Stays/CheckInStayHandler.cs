using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class CheckInStayHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;

    public CheckInStayHandler(IStayStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<StaySummaryDto> Handle(CheckInStayCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyAccess(_currentUser, command.PropertyId) is { } authError)
        {
            return Result<StaySummaryDto>.Failure(authError);
        }

        if (!_currentUser.HasOpenCashierShiftIn(command.PropertyId))
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift in the property before performing check-in."));
        }

        var hasOverridePerm = _currentUser.Permissions.Contains(PermissionKeys.AdminStayOverrideDirtyCheckIn);
        return _store.CheckInStay(command, hasOverridePerm, cashierUserId: _currentUser.UserId);
    }
}
