using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Cashier;

public sealed class OpenAdminCashierShiftHandler
{
    private readonly ICashierShiftStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public OpenAdminCashierShiftHandler(ICashierShiftStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<CashierShiftDto> Handle(OpenAdminCashierShiftCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminCashierOperateShift) is { } authError)
        {
            return Result<CashierShiftDto>.Failure(authError);
        }

        var result = _store.OpenAdminCashierShift(command.PropertyId, _currentUser.UserId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminCashierOperateShift,
                entityId: result.Value.Id,
                reason: $"Opened cashier shift {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, result.Value.Status, result.Value.OpeningFloatCash });
        }

        return result;
    }
}
