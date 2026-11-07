using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Reservations;

public sealed class GetClientAvailabilityHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientAvailabilityHandler(IReservationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AvailabilitySearchResponse> Handle(GetClientAvailabilityQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScopeOnly(_currentUser) is { } authError)
        {
            return Result<AvailabilitySearchResponse>.Failure(authError);
        }

        return _store.SearchAvailability(
            query.PropertyId,
            query.StayMode,
            query.SlotStartAt,
            query.SlotEndAt);
    }
}
