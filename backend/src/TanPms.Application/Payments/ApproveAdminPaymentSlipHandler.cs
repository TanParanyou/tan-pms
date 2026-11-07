using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Payments;

public sealed class ApproveAdminPaymentSlipHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ApproveAdminPaymentSlipHandler(IPaymentSlipStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<AdminPaymentSlipDto> Handle(ApproveAdminPaymentSlipCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminPaymentsVerifySlip) is { } authError)
        {
            return Result<AdminPaymentSlipDto>.Failure(authError);
        }

        var result = _store.ApproveAdminPaymentSlip(command.PropertyId, command.SlipId, _currentUser.UserId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminPaymentsVerifySlip,
                entityId: result.Value.Id,
                reason: $"Approved payment slip for invoice {result.Value.InvoiceDocumentNumber}; receipt {result.Value.ReceiptDocumentNumber}",
                afterState: new
                {
                    result.Value.Status,
                    result.Value.InvoiceDocumentNumber,
                    result.Value.InvoiceStatus,
                    result.Value.Amount,
                    result.Value.ReceiptDocumentNumber
                },
                beforeState: new { Status = "Pending" });
        }

        return result;
    }
}
