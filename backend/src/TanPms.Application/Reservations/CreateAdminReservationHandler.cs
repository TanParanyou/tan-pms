using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class CreateAdminReservationHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CreateAdminReservationHandler(
        IReservationStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(CreateAdminReservationCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminReservationsManage) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        var result = _store.CreateAdminReservation(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminReservationsManage,
                entityId: result.Value.Id,
                reason: $"Created reservation {result.Value.DocumentNumber} ({result.Value.Status})",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Status,
                    result.Value.StayMode
                });
        }

        return result;
    }
}
