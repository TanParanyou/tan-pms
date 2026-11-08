using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Leases;

public sealed class GetClientLeaseIntentsHandler
{
    private readonly ILeaseIntentStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientLeaseIntentsHandler(ILeaseIntentStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<LeaseIntentListResponse> Handle(GetClientLeaseIntentsQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<LeaseIntentListResponse>.Failure(authError)
            : _store.GetClientLeaseIntents(customerId);
    }
}
