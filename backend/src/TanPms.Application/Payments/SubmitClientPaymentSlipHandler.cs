using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Application.Payments;

public sealed class SubmitClientPaymentSlipHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;
    private readonly IAuditLogger _auditLogger;

    public SubmitClientPaymentSlipHandler(IPaymentSlipStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
        _auditLogger = auditLogger;
    }

    public Result<ClientPaymentSlipDto> Handle(SubmitClientPaymentSlipCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ClientPaymentSlipDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.PaymentSlip, null, customerId, command.Request.SlipFileKey) is { } fileError)
        {
            return Result<ClientPaymentSlipDto>.Failure(fileError);
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
