using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class DeleteAdminInvoiceHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminInvoiceHandler(IBillingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<InvoiceItemDto> Handle(DeleteAdminInvoiceCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<InvoiceItemDto>.Failure(authError);
        }

        var result = _store.DeleteAdminInvoice(command.PropertyId, command.InvoiceId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminBillingIssueBatch,
                entityId: result.Value.Id,
                reason: $"Deleted draft invoice {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, Deleted = true },
                beforeState: new { result.Value.Status, result.Value.TotalAmount });
        }

        return result;
    }
}
