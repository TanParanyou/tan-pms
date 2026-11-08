using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class RejectAdminLeaseIntentHandler
{
    private readonly ILeaseIntentStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public RejectAdminLeaseIntentHandler(ILeaseIntentStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseIntentDto> Handle(RejectAdminLeaseIntentCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseIntentDto>.Failure(authError);
        }

        var result = _store.RejectAdminLeaseIntent(command.PropertyId, command.IntentId, _currentUser.UserId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesManage,
                entityId: result.Value.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new { result.Value.LeaseDocumentNumber, result.Value.IntentType, result.Value.DesiredDate, result.Value.Status });
        }

        return result;
    }
}
