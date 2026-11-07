using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class ConfirmAdminReservationHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ConfirmAdminReservationHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(ConfirmAdminReservationCommand command)
    {
        var hasConfirmPermission = _currentUser.Permissions.Contains(PermissionKeys.AdminReservationsManage)
            || _currentUser.Permissions.Contains(PermissionKeys.AdminPaymentsVerifySlip);

        if (!_currentUser.IsAdminScope || !hasConfirmPermission)
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

        var result = _store.ConfirmReservation(command.PropertyId, command.ReservationId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminReservationsManage,
                EntityId = result.Value.Id,
                Reason = $"Confirmed reservation {result.Value.DocumentNumber}",
                AfterStateJson = $"{{\"documentNumber\":\"{result.Value.DocumentNumber}\",\"status\":\"Confirmed\"}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
