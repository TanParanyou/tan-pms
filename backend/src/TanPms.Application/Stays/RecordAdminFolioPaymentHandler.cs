using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class RecordAdminFolioPaymentHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public RecordAdminFolioPaymentHandler(
        IStayStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(RecordAdminFolioPaymentCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckOut,
            PermissionKeys.AdminStayCheckIn,
            PermissionKeys.AdminCashierOperateShift) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        if (string.Equals(command.Request.PaymentMethod, "Cash", StringComparison.OrdinalIgnoreCase)
            && !_currentUser.HasOpenCashierShift)
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift before accepting Cash payments."));
        }

        var result = _store.RecordAdminFolioPayment(command.PropertyId, command.StayId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckOut,
                entityId: result.Value.Id,
                reason: $"Recorded {command.Request.PaymentMethod} payment {command.Request.Amount:0.00} on stay {result.Value.DocumentNumber}",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Folio.BalanceDue
                });
        }

        return result;
    }
}
