using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class ReverseAdminFolioPaymentHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ReverseAdminFolioPaymentHandler(IStayStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(ReverseAdminFolioPaymentCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminInvoicesVoid) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        if (string.Equals(command.Request.PaymentMethod, "Cash", StringComparison.OrdinalIgnoreCase)
            && !_currentUser.HasOpenCashierShiftIn(command.PropertyId))
        {
            return Result<StayDetailDto>.Failure(new Error(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift to reverse a Cash payment."));
        }

        var result = _store.ReverseAdminFolioPayment(command.PropertyId, command.StayId, command.Request, _currentUser.UserId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminInvoicesVoid,
                entityId: result.Value.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new { result.Value.DocumentNumber, command.Request.Amount, command.Request.PaymentMethod, result.Value.Folio.BalanceDue });
        }

        return result;
    }
}
