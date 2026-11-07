using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class GetAdminInvoicesHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminInvoicesHandler(IBillingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<InvoiceListResponse> Handle(GetAdminInvoicesQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<InvoiceListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminInvoices(query.PropertyId, query.Period, query.Status, unmaskPii);
    }
}
