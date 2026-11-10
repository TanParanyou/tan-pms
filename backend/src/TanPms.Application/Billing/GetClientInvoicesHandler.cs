using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Billing;

public sealed class GetClientInvoicesHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientInvoicesHandler(IBillingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientInvoiceListResponse> Handle(GetClientInvoicesQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<ClientInvoiceListResponse>.Failure(authError)
            : _store.GetClientInvoices(customerId, query.Status, paging: PageRequest.From(query.Page, query.PageSize));
    }
}
