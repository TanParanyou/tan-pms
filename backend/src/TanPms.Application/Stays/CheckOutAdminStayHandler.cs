using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class CheckOutAdminStayHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CheckOutAdminStayHandler(
        IStayStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(CheckOutAdminStayCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckOut) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        if (!_currentUser.HasOpenCashierShift)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift before completing check-out and deposit settlement."));
        }

        var result = _store.CheckOutAdminStay(command.PropertyId, command.StayId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckOut,
                entityId: result.Value.Id,
                reason: string.IsNullOrWhiteSpace(command.Request.DeductionOrRefundReason)
                    ? $"Completed check-out for stay {result.Value.DocumentNumber}"
                    : command.Request.DeductionOrRefundReason.Trim(),
                afterState: new
                {
                    result.Value.DocumentNumber,
                    Status = "CheckedOut",
                    Housekeeping = result.Value.GeneratedHousekeepingTaskStatus
                });
        }

        return result;
    }
}
