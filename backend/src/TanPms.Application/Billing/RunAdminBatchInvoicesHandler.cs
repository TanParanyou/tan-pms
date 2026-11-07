using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class RunAdminBatchInvoicesHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public RunAdminBatchInvoicesHandler(IBillingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<BatchInvoiceRunResponse> Handle(RunAdminBatchInvoicesCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<BatchInvoiceRunResponse>.Failure(authError);
        }

        var result = _store.RunAdminBatchInvoices(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is { Created.Count: > 0 } run)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminBillingIssueBatch,
                entityId: command.PropertyId,
                reason: $"Batch invoice run {run.Period}: {run.Created.Count} draft(s), {run.Skipped.Count} skipped",
                afterState: new { run.Period, Created = run.Created.Select(i => i.DocumentNumber).ToList() });
        }

        return result;
    }
}
