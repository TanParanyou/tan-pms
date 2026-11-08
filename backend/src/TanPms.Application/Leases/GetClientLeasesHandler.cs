using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Leases;

public sealed class GetClientLeasesHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientLeasesHandler(ILeaseStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<LeaseListResponse> Handle(GetClientLeasesQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<LeaseListResponse>.Failure(authError)
            : _store.GetClientLeases(customerId);
    }
}
