using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class AddAdminLeaseVehicleHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public AddAdminLeaseVehicleHandler(
        ILeaseStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseItemDto> Handle(AddAdminLeaseVehicleCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseItemDto>.Failure(authError);
        }

        var result = _store.AddAdminLeaseVehicle(command.PropertyId, command.LeaseId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesManage,
                entityId: result.Value.Id,
                reason: $"Registered vehicle {command.Request.LicensePlate.Trim()} on lease {result.Value.DocumentNumber}",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Status,
                    result.Value.EndDate,
                    result.Value.MonthlyRentAmount
                });
        }

        return result;
    }
}
