using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class CancelAdminReservationHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CancelAdminReservationHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(CancelAdminReservationCommand command)
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

        if (string.IsNullOrWhiteSpace(command.Request.Reason))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Audit reason is required when cancelling or marking NoShow."));
        }

        var result = _store.CancelReservation(command.PropertyId, command.ReservationId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminReservationsManage,
                EntityId = result.Value.Id,
                Reason = command.Request.Reason.Trim(),
                AfterStateJson = $"{{\"documentNumber\":\"{result.Value.DocumentNumber}\",\"status\":\"{result.Value.Status}\"}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
