using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Billing;

public sealed class GetClientReceiptsHandler
{
    private readonly IReceiptStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientReceiptsHandler(IReceiptStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReceiptListResponse> Handle(GetClientReceiptsQuery query)
    {
        return ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError
            ? Result<ReceiptListResponse>.Failure(authError)
            : _store.GetClientReceipts(customerId);
    }
}
