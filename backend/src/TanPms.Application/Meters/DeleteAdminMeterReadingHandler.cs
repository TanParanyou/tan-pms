using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Meters;

public sealed class DeleteAdminMeterReadingHandler
{
    private readonly IMeterReadingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminMeterReadingHandler(IMeterReadingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<MeterReadingSheetRowDto> Handle(DeleteAdminMeterReadingCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminMetersRecord) is { } authError)
        {
            return Result<MeterReadingSheetRowDto>.Failure(authError);
        }

        var canOverride = _currentUser.Permissions.Contains(PermissionKeys.AdminMetersOverrideLocked);
        var result = _store.DeleteAdminMeterReading(
            command.PropertyId,
            command.UnitId,
            command.Period,
            command.OverrideReason,
            canOverride);
        if (result.IsSuccess && result.Value is { } row)
        {
            // A locked row can only be deleted through the override path, so its audit carries the high-risk key.
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: row.IsLocked ? PermissionKeys.AdminMetersOverrideLocked : PermissionKeys.AdminMetersRecord,
                entityId: command.UnitId,
                reason: row.IsLocked
                    ? command.OverrideReason!.Trim()
                    : $"Deleted meter readings of unit {row.Unit.UnitNumber} for {command.Period}",
                afterState: new { command.Period, row.Unit.UnitNumber, Deleted = true });
        }

        return result;
    }
}
