using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Application.WorkOrders;

public sealed class CreateClientWorkOrderHandler
{
    public const string ClientCreateActionKey = "client.workorders.create";

    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;
    private readonly IAuditLogger _auditLogger;

    public CreateClientWorkOrderHandler(IWorkOrderStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
        _auditLogger = auditLogger;
    }

    public Result<WorkOrderItemDto> Handle(CreateClientWorkOrderCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<WorkOrderItemDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.WorkOrderPhoto, null, customerId, command.Request.BeforePhotoFileKey) is { } fileError)
        {
            return Result<WorkOrderItemDto>.Failure(fileError);
        }

        var result = _store.CreateClientWorkOrder(customerId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.PropertyId,
                actionKey: ClientCreateActionKey,
                entityId: result.Value.Id,
                reason: $"Client reported work order {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, result.Value.Status, result.Value.IssueSummary });
        }

        return result;
    }
}
