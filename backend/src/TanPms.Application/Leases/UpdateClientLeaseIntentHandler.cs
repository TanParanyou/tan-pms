using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Leases;

public sealed class UpdateClientLeaseIntentHandler
{
    private readonly ILeaseIntentStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpdateClientLeaseIntentHandler(ILeaseIntentStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseIntentDto> Handle(UpdateClientLeaseIntentCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<LeaseIntentDto>.Failure(authError);
        }

        var result = _store.UpdateClientLeaseIntent(customerId, command.IntentId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.PropertyId,
                actionKey: LeaseIntentRules.ClientUpdateActionKey,
                entityId: result.Value.Id,
                reason: $"Client updated {result.Value.IntentType} intent for lease {result.Value.LeaseDocumentNumber}",
                afterState: new { result.Value.LeaseDocumentNumber, result.Value.IntentType, result.Value.DesiredDate, result.Value.Status });
        }

        return result;
    }
}
