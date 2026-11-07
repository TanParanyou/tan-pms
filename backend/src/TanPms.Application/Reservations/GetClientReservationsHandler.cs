using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Reservations;

public sealed class GetClientReservationsHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientReservationsHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationListResponse> Handle(GetClientReservationsQuery _)
    {
        if (!_currentUser.IsClientScope || _currentUser.CustomerId is null || _currentUser.CustomerId == Guid.Empty)
        {
            return Result<ReservationListResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId."));
        }

        return _store.GetClientReservations(_currentUser.CustomerId.Value);
    }
}
