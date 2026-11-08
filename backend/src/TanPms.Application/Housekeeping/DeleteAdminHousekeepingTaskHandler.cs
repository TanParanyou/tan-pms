using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Housekeeping;

public sealed class DeleteAdminHousekeepingTaskHandler
{
    private readonly IHousekeepingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminHousekeepingTaskHandler(IHousekeepingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<HousekeepingTaskDto> Handle(DeleteAdminHousekeepingTaskCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminHousekeepingUpdate) is { } authError)
        {
            return Result<HousekeepingTaskDto>.Failure(authError);
        }

        var result = _store.DeleteAdminHousekeepingTask(command.PropertyId, command.TaskId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminHousekeepingUpdate,
                entityId: result.Value.Id,
                reason: $"Deleted pending housekeeping task for unit {result.Value.Unit.UnitNumber}",
                afterState: new { result.Value.SourceDocumentNumber, Deleted = true });
        }

        return result;
    }
}
