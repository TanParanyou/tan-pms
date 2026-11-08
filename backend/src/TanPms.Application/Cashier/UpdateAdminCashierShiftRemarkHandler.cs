using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class UpdateAdminCashierShiftRemarkHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpdateAdminCashierShiftRemarkHandler(ICashierShiftStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<CashierShiftDto> Handle(UpdateAdminCashierShiftRemarkCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminCashierOperateShift,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<CashierShiftDto>.Failure(authError);
        }

        var isSupervisor = _currentUser.Permissions.Contains(PermissionKeys.AdminCashierReconcileShift);
        var before = _store.GetAdminCashierShift(command.PropertyId, command.ShiftId);
        var result = _store.UpdateAdminCashierShiftRemark(
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
                reason: $"Edited variance remark of cashier shift {result.Value.DocumentNumber}",
                afterState: new { result.Value.VarianceRemark, result.Value.CashVariance },
                beforeState: new { before.Value?.VarianceRemark });
        }

        return result;
    }
}
