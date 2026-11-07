using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class IssueAdminInvoicesForPeriodHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;
    private readonly INotificationSender _notificationSender;

    public IssueAdminInvoicesForPeriodHandler(
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

    public Result<InvoiceIssueResponse> Handle(IssueAdminInvoicesForPeriodCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<InvoiceIssueResponse>.Failure(authError);
        }

        var result = _store.IssueAdminInvoicesForPeriod(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            foreach (var invoice in result.Value.Issued)
            {
                InvoiceIssueNotifier.RecordIssued(
                    _auditLogger, _notificationSender, command.PropertyId, PermissionKeys.AdminBillingIssueBatch, invoice);
            }
        }

        return result;
    }
}
