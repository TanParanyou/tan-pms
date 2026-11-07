using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Meters;

public sealed class SaveAdminMeterReadingsHandler
{
    private readonly IMeterReadingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public SaveAdminMeterReadingsHandler(
        IMeterReadingStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<SaveMeterReadingsResponse> Handle(SaveAdminMeterReadingsCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminMetersRecord) is { } authError)
        {
            return Result<SaveMeterReadingsResponse>.Failure(authError);
        }

        var canOverride = _currentUser.Permissions.Contains(PermissionKeys.AdminMetersOverrideLocked);
        var result = _store.SaveAdminMeterReadings(command.PropertyId, command.Request, canOverride);
        if (result.IsSuccess && result.Value is { IsSaved: true } saved)
        {
            foreach (var row in saved.Rows.Where(r => r.IsLockedOverride))
            {
                _auditLogger.RecordMutation(
                    propertyId: command.PropertyId,
                    actionKey: PermissionKeys.AdminMetersOverrideLocked,
                    entityId: row.UnitId,
                    reason: command.Request.OverrideReason!.Trim(),
                    afterState: new { saved.Period, row.UnitNumber, row.Water, row.Electric });
            }

            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminMetersRecord,
                entityId: command.PropertyId,
                reason: $"Saved {saved.Rows.Count} meter reading rows for {saved.Period}",
                afterState: new { saved.Period, Units = saved.Rows.Select(r => r.UnitNumber).ToList() });
        }

        return result;
    }
}
