using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class IssueAdminInvoiceHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;
    private readonly INotificationSender _notificationSender;

    public IssueAdminInvoiceHandler(
        IBillingStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger,
        INotificationSender notificationSender)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
        _notificationSender = notificationSender;
    }

    public Result<InvoiceItemDto> Handle(IssueAdminInvoiceCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<InvoiceItemDto>.Failure(authError);
        }

        var result = _store.IssueAdminInvoice(command.PropertyId, command.InvoiceId);
        if (result.IsSuccess && result.Value is not null)
        {
            InvoiceIssueNotifier.RecordIssued(
                _auditLogger, _notificationSender, command.PropertyId, PermissionKeys.AdminBillingIssueBatch, result.Value);
        }

        return result;
    }
}
