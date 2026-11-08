using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Meters;

public sealed class GetClientUtilityUsageHandler
{
    private readonly IMeterReadingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientUtilityUsageHandler(IMeterReadingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientUtilityUsageResponse> Handle(GetClientUtilityUsageQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<ClientUtilityUsageResponse>.Failure(authError)
            : _store.GetClientUtilityUsage(customerId, query.LeaseId, Math.Clamp(query.Months ?? 12, 1, 36));
    }
}
