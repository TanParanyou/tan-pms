using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Housekeeping;

public sealed class CreateAdminHousekeepingTaskHandler
{
    private readonly IHousekeepingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CreateAdminHousekeepingTaskHandler(IHousekeepingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<HousekeepingTaskDto> Handle(CreateAdminHousekeepingTaskCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminHousekeepingUpdate) is { } authError)
        {
            return Result<HousekeepingTaskDto>.Failure(authError);
        }

        var result = _store.CreateAdminHousekeepingTask(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminHousekeepingUpdate,
                entityId: result.Value.Id,
                reason: $"Created manual housekeeping task for unit {result.Value.Unit.UnitNumber}",
                afterState: new { result.Value.Status, result.Value.AssignedStaffUserId, result.Value.Note });
        }

        return result;
    }
}
