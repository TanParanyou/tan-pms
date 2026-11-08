using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Payments;

public sealed class GetClientPaymentSlipsHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientPaymentSlipsHandler(IPaymentSlipStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ClientPaymentSlipListResponse> Handle(GetClientPaymentSlipsQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<ClientPaymentSlipListResponse>.Failure(authError)
            : _store.GetClientPaymentSlips(customerId);
    }
}
