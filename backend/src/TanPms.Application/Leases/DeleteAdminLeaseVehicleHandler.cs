using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class DeleteAdminLeaseVehicleHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminLeaseVehicleHandler(ILeaseStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseItemDto> Handle(DeleteAdminLeaseVehicleCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseItemDto>.Failure(authError);
        }

        var result = _store.DeleteAdminLeaseVehicle(command.PropertyId, command.LeaseId, command.VehicleId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesManage,
                entityId: command.VehicleId,
                reason: $"Removed vehicle from lease {result.Value.DocumentNumber}",
                afterState: new { result.Value.DocumentNumber, result.Value.Status, OccupantCount = result.Value.Occupants.Count, VehicleCount = result.Value.Vehicles.Count });
        }

        return result;
    }
}
