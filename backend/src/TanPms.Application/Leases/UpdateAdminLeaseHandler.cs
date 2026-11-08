using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class UpdateAdminLeaseHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpdateAdminLeaseHandler(ILeaseStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseItemDto> Handle(UpdateAdminLeaseCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseItemDto>.Failure(authError);
        }

        var before = _store.GetAdminLease(command.PropertyId, command.LeaseId);
        var result = _store.UpdateAdminLease(command.PropertyId, command.LeaseId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesManage,
                entityId: result.Value.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.MonthlyRentAmount,
                    result.Value.InitialWaterMeterReading,
                    result.Value.InitialElectricMeterReading
                },
                beforeState: before.Value is { } b
                    ? new { b.MonthlyRentAmount, b.InitialWaterMeterReading, b.InitialElectricMeterReading }
                    : null);
        }

        return result;
    }
}
