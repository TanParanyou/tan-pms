using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Reservations;

public sealed class GetClientAvailabilityHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientAvailabilityHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AvailabilitySearchResponse> Handle(GetClientAvailabilityQuery query)
    {
        if (!_currentUser.IsClientScope)
        {
            return Result<AvailabilitySearchResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope."));
        }

        return _store.SearchAvailability(
            query.PropertyId,
            query.StayMode,
            query.SlotStartAt,
            query.SlotEndAt);
    }
}
