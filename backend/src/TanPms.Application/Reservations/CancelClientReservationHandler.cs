using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Reservations;

namespace TanPms.Application.Reservations;

public sealed class CancelClientReservationHandler
{
    public const string ActionKey = "client.reservations.cancel";

    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CancelClientReservationHandler(IReservationStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ReservationItemDto> Handle(CancelClientReservationCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        if (command.Request.Validate() is { } reasonError)
        {
            return Result<ReservationItemDto>.Failure(reasonError);
        }

        var own = _store.GetClientReservations(customerId);
        var reservation = own.Value?.Items.FirstOrDefault(r => r.Id == command.ReservationId);
        if (reservation is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.PermissionDenied, "Reservation was not found for the current customer."));
        }

        // Clients may only release their own unpaid Hold; anything with a slip or confirmation goes through the front desk.
        if (reservation.Status != nameof(ReservationStatus.Hold))
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Only a Hold can be cancelled by the client (current: {reservation.Status})."));
        }

        var result = _store.CancelReservation(
            reservation.Property.Id,
            reservation.Id,
            new CancelReservationRequest(command.Request.Reason.Trim(), MarkNoShow: false));
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: reservation.Property.Id,
                actionKey: ActionKey,
                entityId: reservation.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new { result.Value.DocumentNumber, result.Value.Status });
        }

        return result;
    }
}
