using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Leases;

public sealed class GetClientLeaseHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientLeaseHandler(ILeaseStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<LeaseItemDto> Handle(GetClientLeaseQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<LeaseItemDto>.Failure(authError)
            : _store.GetClientLease(customerId, query.LeaseId);
    }
}
