using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Client;

public sealed class GetClientDashboardHandler
{
    private readonly IClientDashboardStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientDashboardHandler(IClientDashboardStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientDashboardResponse> Handle(GetClientDashboardQuery _)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ClientDashboardResponse>.Failure(authError);
        }

        return _store.GetClientDashboard(customerId);
    }
}
