using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;

namespace TanPms.Application.Reservations;

public sealed class GetClientReservationHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientReservationHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationItemDto> Handle(GetClientReservationQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        // The own-reservation list is already customer-scoped (and expires stale holds), so pick from it.
        var own = _store.GetClientReservations(customerId);
        if (own.IsFailure || own.Value is null)
        {
            return Result<ReservationItemDto>.Failure(own.Error!);
        }

        var reservation = own.Value.Items.FirstOrDefault(r => r.Id == query.ReservationId);
        return reservation is null
            ? Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.PermissionDenied, "Reservation was not found for the current customer."))
            : Result<ReservationItemDto>.Success(reservation);
    }
}
