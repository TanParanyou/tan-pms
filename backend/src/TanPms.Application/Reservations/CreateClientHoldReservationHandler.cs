using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Reservations;

public sealed class CreateClientHoldReservationHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public CreateClientHoldReservationHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationItemDto> Handle(CreateClientHoldReservationCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        return _store.CreateClientHoldReservation(customerId, command.Request);
    }
}
