using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class GetAdminReceiptsHandler
{
    private readonly IReceiptStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminReceiptsHandler(IReceiptStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<ReceiptListResponse> Handle(GetAdminReceiptsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            ReceiptRules.AdminReadPermissions) is { } authError)
        {
            return Result<ReceiptListResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminReceipts(query.PropertyId, query.InvoiceId, unmaskPii);
    }
}
