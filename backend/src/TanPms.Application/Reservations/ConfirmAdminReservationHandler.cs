using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class ConfirmAdminReservationHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ConfirmAdminReservationHandler(
        IReservationStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(ConfirmAdminReservationCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminReservationsManage,
            PermissionKeys.AdminPaymentsVerifySlip) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        var result = _store.ConfirmReservation(command.PropertyId, command.ReservationId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminReservationsManage,
                entityId: result.Value.Id,
                reason: $"Confirmed reservation {result.Value.DocumentNumber}",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    Status = "Confirmed"
                });
        }

        return result;
    }
}
