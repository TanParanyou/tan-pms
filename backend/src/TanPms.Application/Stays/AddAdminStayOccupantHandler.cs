using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Application.Stays;

public sealed class AddAdminStayOccupantHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;
    private readonly IStoredFileStore _files;

    public AddAdminStayOccupantHandler(IStayStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
        _files = files;
    }

    public Result<StayDetailDto> Handle(AddAdminStayOccupantCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckIn) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.IdentityDocument, command.PropertyId, null, command.Request.IdentityDocumentFileKey) is { } fileError)
        {
            return Result<StayDetailDto>.Failure(fileError);
        }

        var result = _store.AddAdminStayOccupant(command.PropertyId, command.StayId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckIn,
                entityId: result.Value.Id,
                reason: $"Added occupant to stay {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, OccupantCount = result.Value.Occupants.Count });
        }

        return result;
    }
}
