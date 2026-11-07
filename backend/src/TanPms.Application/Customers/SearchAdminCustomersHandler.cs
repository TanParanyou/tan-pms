using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Customers;

public sealed class SearchAdminCustomersHandler
{
    private readonly ICustomerStore _store;
    private readonly ICurrentUserContext _currentUser;

    public SearchAdminCustomersHandler(ICustomerStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<CustomerListResponse> Handle(SearchAdminCustomersQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminLeasesManage,
            PermissionKeys.AdminStayCheckIn,
            PermissionKeys.AdminReservationsRead,
            PermissionKeys.AdminReservationsManage) is { } authError)
        {
            return Result<CustomerListResponse>.Failure(authError);
        }

        return _store.SearchAdminCustomers(query.PropertyId, query.Search);
    }
}
