using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;

namespace TanPms.Application.WorkOrders;

public sealed class ResolveAdminWorkOrderHandler
{
    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;
    private readonly IAuditLogger _auditLogger;

    public ResolveAdminWorkOrderHandler(IWorkOrderStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
        _auditLogger = auditLogger;
    }

    public Result<WorkOrderItemDto> Handle(ResolveAdminWorkOrderCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminWorkOrdersManage) is { } authError)
        {
            return Result<WorkOrderItemDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.WorkOrderPhoto, command.PropertyId, null, command.Request.AfterPhotoFileKey) is { } fileError)
        {
            return Result<WorkOrderItemDto>.Failure(fileError);
        }

        var result = _store.ResolveAdminWorkOrder(command.PropertyId, command.WorkOrderId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminWorkOrdersManage,
                entityId: result.Value.Id,
                reason: $"Resolved work order {result.Value.DocumentNumber}",
                afterState: new
                {
                    result.Value.Status,
                    result.Value.AssignedTechnicianUserId,
                    result.Value.TenantChargeAmount,
                    result.Value.ChargeDocumentNumber
                });
        }

        return result;
    }
}
