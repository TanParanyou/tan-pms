using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Application.Payments;

public sealed class UpdateClientPaymentSlipHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;
    private readonly IAuditLogger _auditLogger;

    public UpdateClientPaymentSlipHandler(IPaymentSlipStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
        _auditLogger = auditLogger;
    }

    public Result<ClientPaymentSlipDto> Handle(UpdateClientPaymentSlipCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ClientPaymentSlipDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.PaymentSlip, null, customerId, command.Request.SlipFileKey) is { } fileError)
        {
            return Result<ClientPaymentSlipDto>.Failure(fileError);
        }

        var result = _store.UpdateClientPaymentSlip(customerId, command.InvoiceId, command.SlipId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.PropertyId,
                actionKey: PaymentSlipRules.ClientUpdateActionKey,
                entityId: result.Value.Id,
                reason: $"Client updated pending payment slip for invoice {result.Value.InvoiceDocumentNumber}",
                afterState: new { result.Value.InvoiceDocumentNumber, result.Value.Amount, result.Value.Status });
        }

        return result;
    }
}
