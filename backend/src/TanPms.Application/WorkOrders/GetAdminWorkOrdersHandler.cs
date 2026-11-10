using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.WorkOrders;

public sealed class GetAdminWorkOrdersHandler
{
    private readonly IWorkOrderStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminWorkOrdersHandler(IWorkOrderStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<WorkOrderListResponse> Handle(GetAdminWorkOrdersQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminWorkOrdersManage) is { } authError)
        {
            return Result<WorkOrderListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminWorkOrders(query.PropertyId, query.Status, unmaskPii, paging: PageRequest.From(query.Page, query.PageSize));
    }
}
