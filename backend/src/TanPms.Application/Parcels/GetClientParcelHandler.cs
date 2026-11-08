using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Parcels;

public sealed class GetClientParcelHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientParcelHandler(IParcelStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ParcelItemDto> Handle(GetClientParcelQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ParcelItemDto>.Failure(authError);
        }

        return _store.GetClientParcel(customerId, query.ParcelId);
    }
}
