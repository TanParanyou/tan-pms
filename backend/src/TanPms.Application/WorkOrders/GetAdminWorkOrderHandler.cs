using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.WorkOrders;

public sealed class GetAdminWorkOrderHandler
{
    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminWorkOrderHandler(IWorkOrderStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<WorkOrderItemDto> Handle(GetAdminWorkOrderQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminWorkOrdersManage) is { } authError)
        {
            return Result<WorkOrderItemDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminWorkOrder(query.PropertyId, query.WorkOrderId, unmaskPii);
    }
}
