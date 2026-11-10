using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.WorkOrders;

public sealed class GetClientWorkOrdersHandler
{
    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientWorkOrdersHandler(IWorkOrderStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<WorkOrderListResponse> Handle(GetClientWorkOrdersQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<WorkOrderListResponse>.Failure(authError);
        }

        return _store.GetClientWorkOrders(customerId, query.Status, paging: PageRequest.From(query.Page, query.PageSize));
    }
}
