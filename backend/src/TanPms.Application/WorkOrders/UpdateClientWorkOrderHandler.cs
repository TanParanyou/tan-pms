using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.WorkOrders;

public sealed class UpdateClientWorkOrderHandler
{
    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpdateClientWorkOrderHandler(IWorkOrderStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<WorkOrderItemDto> Handle(UpdateClientWorkOrderCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<WorkOrderItemDto>.Failure(authError);
        }

        var result = _store.UpdateClientWorkOrder(customerId, command.WorkOrderId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.PropertyId,
                actionKey: WorkOrderRules.ClientUpdateActionKey,
                entityId: result.Value.Id,
                reason: $"Client updated work order {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, result.Value.Status, result.Value.Priority, result.Value.IssueSummary });
        }

        return result;
    }
}
