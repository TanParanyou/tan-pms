using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Payments;

public sealed class GetAdminPaymentSlipsHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPaymentSlipsHandler(IPaymentSlipStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<PaymentSlipQueueResponse> Handle(GetAdminPaymentSlipsQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminPaymentsVerifySlip) is { } authError)
        {
            return Result<PaymentSlipQueueResponse>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminPaymentSlips(query.PropertyId, query.Status, unmaskPii);
    }
}
