using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class CloseAdminCashierShiftHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CloseAdminCashierShiftHandler(ICashierShiftStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<CashierShiftDto> Handle(CloseAdminCashierShiftCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminCashierOperateShift) is { } authError)
        {
            return Result<CashierShiftDto>.Failure(authError);
        }

        var result = _store.CloseAdminCashierShift(command.PropertyId, command.ShiftId, _currentUser.UserId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminCashierOperateShift,
                entityId: result.Value.Id,
                reason: string.IsNullOrWhiteSpace(command.Request.VarianceRemark)
                    ? $"Closed cashier shift {result.Value.DocumentNumber}"
                    : command.Request.VarianceRemark.Trim(),
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Status,
                    result.Value.ExpectedDrawerCash,
                    result.Value.ActualCashCounted,
                    result.Value.CashVariance
                });
        }

        return result;
    }
}
