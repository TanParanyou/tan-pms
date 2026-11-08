using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class CancelAdminCashierShiftHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CancelAdminCashierShiftHandler(ICashierShiftStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<CashierShiftDto> Handle(CancelAdminCashierShiftCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminCashierOperateShift,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<CashierShiftDto>.Failure(authError);
        }

        // Cashiers may cancel only their own shift; supervisors (reconcile permission) may cancel any.
        var isSupervisor = _currentUser.Permissions.Contains(PermissionKeys.AdminCashierReconcileShift);
        var result = _store.CancelAdminCashierShift(
            command.PropertyId,
            command.ShiftId,
            isSupervisor ? null : _currentUser.UserId,
            command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: isSupervisor ? PermissionKeys.AdminCashierReconcileShift : PermissionKeys.AdminCashierOperateShift,
                entityId: result.Value.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new { result.Value.DocumentNumber, result.Value.Status, result.Value.CashierUserId });
        }

        return result;
    }
}
