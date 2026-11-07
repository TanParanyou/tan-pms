using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class AssignAdminReservationUnitHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public AssignAdminReservationUnitHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(AssignAdminReservationUnitCommand command)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminReservationsManage))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminReservationsManage}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
        }

        var result = _store.AssignReservationUnit(command.PropertyId, command.ReservationId, command.Request.UnitId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminReservationsManage,
                EntityId = result.Value.Id,
                Reason = $"Assigned unit {result.Value.AssignedUnit?.UnitNumber} to reservation {result.Value.DocumentNumber}",
                AfterStateJson = $"{{\"documentNumber\":\"{result.Value.DocumentNumber}\",\"unitId\":\"{command.Request.UnitId}\"}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
