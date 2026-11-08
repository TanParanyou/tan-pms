using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;

namespace TanPms.Application.Parcels;

public sealed class UpdateAdminParcelHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;
    private readonly IAuditLogger _auditLogger;

    public UpdateAdminParcelHandler(IParcelStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
        _auditLogger = auditLogger;
    }

    public Result<ParcelItemDto> Handle(UpdateAdminParcelCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminParcelsManage) is { } authError)
        {
            return Result<ParcelItemDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.ParcelPhoto, command.PropertyId, null, command.Request.PhotoFileKey) is { } fileError)
        {
            return Result<ParcelItemDto>.Failure(fileError);
        }

        var result = _store.UpdateAdminParcel(command.PropertyId, command.ParcelId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminParcelsManage,
                entityId: result.Value.Id,
                reason: $"Updated parcel {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, UnitId = result.Value.Unit.Id, result.Value.CarrierName, result.Value.TrackingNumber });
        }

        return result;
    }
}
