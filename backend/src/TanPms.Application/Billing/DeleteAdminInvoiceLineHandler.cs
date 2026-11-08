using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class DeleteAdminInvoiceLineHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminInvoiceLineHandler(IBillingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<InvoiceItemDto> Handle(DeleteAdminInvoiceLineCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<InvoiceItemDto>.Failure(authError);
        }

        var result = _store.DeleteAdminInvoiceLine(command.PropertyId, command.InvoiceId, command.LineId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminBillingIssueBatch,
                entityId: result.Value.Id,
                reason: $"Removed line {command.LineId} from draft invoice {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, result.Value.Status, LineCount = result.Value.Lines.Count, result.Value.TotalAmount });
        }

        return result;
    }
}
