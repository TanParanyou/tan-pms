using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class CancelAdminReservationHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CancelAdminReservationHandler(
        IReservationStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(CancelAdminReservationCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminReservationsManage) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
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
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminReservationsManage,
                entityId: result.Value.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Status
                });
        }

        return result;
    }
}
