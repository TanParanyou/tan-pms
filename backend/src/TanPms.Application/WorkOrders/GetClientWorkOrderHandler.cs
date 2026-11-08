using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.WorkOrders;

public sealed class GetClientWorkOrderHandler
{
    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientWorkOrderHandler(IWorkOrderStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<WorkOrderItemDto> Handle(GetClientWorkOrderQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<WorkOrderItemDto>.Failure(authError);
        }

        return _store.GetClientWorkOrder(customerId, query.WorkOrderId);
    }
}
