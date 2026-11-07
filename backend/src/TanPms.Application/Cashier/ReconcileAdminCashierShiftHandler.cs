using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class ReconcileAdminCashierShiftHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ReconcileAdminCashierShiftHandler(ICashierShiftStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<CashierShiftDto> Handle(ReconcileAdminCashierShiftCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminCashierReconcileShift) is { } authError)
        {
            return Result<CashierShiftDto>.Failure(authError);
        }

        var result = _store.ReconcileAdminCashierShift(command.PropertyId, command.ShiftId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminCashierReconcileShift,
                entityId: result.Value.Id,
                reason: string.IsNullOrWhiteSpace(command.Request.Remark)
                    ? $"Reconciled cashier shift {result.Value.DocumentNumber}"
                    : command.Request.Remark.Trim(),
                afterState: new { result.Value.DocumentNumber, result.Value.Status, result.Value.CashVariance, result.Value.VarianceRemark },
                beforeState: new { Status = "Closed" });
        }

        return result;
    }
}
