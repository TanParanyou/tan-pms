using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class GetAdminInvoiceHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminInvoiceHandler(IBillingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<InvoiceItemDto> Handle(GetAdminInvoiceQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<InvoiceItemDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminInvoice(query.PropertyId, query.InvoiceId, unmaskPii);
    }
}
