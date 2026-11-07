using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Payments;

public sealed class SubmitClientPaymentSlipHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public SubmitClientPaymentSlipHandler(IPaymentSlipStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ClientPaymentSlipDto> Handle(SubmitClientPaymentSlipCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ClientPaymentSlipDto>.Failure(authError);
        }

        var result = _store.SubmitClientPaymentSlip(customerId, command.InvoiceId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.PropertyId,
                actionKey: PaymentSlipRules.ClientSubmitActionKey,
                entityId: result.Value.Id,
                reason: $"Client submitted payment slip for invoice {result.Value.InvoiceDocumentNumber}",
                afterState: new { result.Value.InvoiceDocumentNumber, result.Value.Amount, result.Value.Status });
        }

        return result;
    }
}
