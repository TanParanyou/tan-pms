using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Reservations;

public sealed class CreateClientHoldReservationHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public CreateClientHoldReservationHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationItemDto> Handle(CreateClientHoldReservationCommand command)
    {
        if (!_currentUser.IsClientScope || _currentUser.CustomerId is null || _currentUser.CustomerId == Guid.Empty)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId."));
        }

        return _store.CreateClientHoldReservation(_currentUser.CustomerId.Value, command.Request);
    }
}
