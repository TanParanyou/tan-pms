using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Reservations;

public sealed class GetClientReservationsHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientReservationsHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReservationListResponse> Handle(GetClientReservationsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ReservationListResponse>.Failure(authError);
        }

        return _store.GetClientReservations(customerId, paging: PageRequest.From(query.Page, query.PageSize));
    }
}
