using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Reservations;

public sealed class SubmitClientReservationSlipHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public SubmitClientReservationSlipHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationItemDto> Handle(SubmitClientReservationSlipCommand command)
    {
        if (!_currentUser.IsClientScope || _currentUser.CustomerId is null || _currentUser.CustomerId == Guid.Empty)
        {
            return Result<ReservationItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId."));
        }

        return _store.SubmitClientReservationSlip(
            _currentUser.CustomerId.Value,
            command.ReservationId,
            command.Request);
    }
}
