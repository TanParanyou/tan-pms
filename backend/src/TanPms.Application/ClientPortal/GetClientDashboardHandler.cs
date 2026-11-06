using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.ClientPortal;

public sealed class GetClientDashboardHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientDashboardHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientDashboardResponse> Handle(GetClientDashboardQuery _)
    {
        if (!_currentUser.IsClientScope || _currentUser.CustomerId is null || _currentUser.CustomerId == Guid.Empty)
        {
            return Result<ClientDashboardResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId."));
        }

        return _store.GetClientDashboard(_currentUser.CustomerId.Value);
    }
}
