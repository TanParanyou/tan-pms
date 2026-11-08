using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Parcels;

public sealed class GetClientParcelsHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientParcelsHandler(IParcelStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ParcelListResponse> Handle(GetClientParcelsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ParcelListResponse>.Failure(authError);
        }

        return _store.GetClientParcels(customerId, query.Status);
    }
}
