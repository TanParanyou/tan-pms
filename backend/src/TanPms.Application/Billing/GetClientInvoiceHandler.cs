using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Billing;

public sealed class GetClientInvoiceHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientInvoiceHandler(IBillingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientInvoiceDto> Handle(GetClientInvoiceQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<ClientInvoiceDto>.Failure(authError)
            : _store.GetClientInvoice(customerId, query.InvoiceId);
    }
}
