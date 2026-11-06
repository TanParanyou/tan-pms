using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Stays;

public sealed class CheckInStayHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public CheckInStayHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<StaySummaryDto> Handle(CheckInStayCommand command)
    {
        if (!_currentUser.IsAdminScope)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires AdminScope authorization."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
        }

        if (!_currentUser.HasOpenCashierShift)
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift in the property before performing check-in."));
        }

        var hasOverridePerm = _currentUser.Permissions.Contains("admin.stay.override_dirty_checkin");
        return _store.CheckInStay(command, hasOverridePerm);
    }
}
