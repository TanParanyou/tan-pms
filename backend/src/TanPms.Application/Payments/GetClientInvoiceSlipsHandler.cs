using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Payments;

public sealed class GetClientInvoiceSlipsHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientInvoiceSlipsHandler(IPaymentSlipStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientPaymentSlipListResponse> Handle(GetClientInvoiceSlipsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ClientPaymentSlipListResponse>.Failure(authError);
        }

        return _store.GetClientInvoiceSlips(customerId, query.InvoiceId);
    }
}
