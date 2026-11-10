using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class DeleteAdminStayOccupantHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminStayOccupantHandler(IStayStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(DeleteAdminStayOccupantCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckIn) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        var result = _store.DeleteAdminStayOccupant(command.PropertyId, command.StayId, command.OccupantId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckIn,
                entityId: command.OccupantId,
                reason: $"Removed occupant from stay {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, OccupantCount = result.Value.Occupants.Count });
        }

        return result;
    }
}
