using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Reservations;

public sealed class CreateAdminReservationHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CreateAdminReservationHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(CreateAdminReservationCommand command)
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

        var result = _store.CreateAdminReservation(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminReservationsManage,
                EntityId = result.Value.Id,
                Reason = $"Created reservation {result.Value.DocumentNumber} ({result.Value.Status})",
                AfterStateJson = $"{{\"documentNumber\":\"{result.Value.DocumentNumber}\",\"status\":\"{result.Value.Status}\",\"stayMode\":\"{result.Value.StayMode}\"}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
