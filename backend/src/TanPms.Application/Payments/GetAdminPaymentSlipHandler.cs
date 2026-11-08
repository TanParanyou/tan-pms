using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Payments;

public sealed class GetAdminPaymentSlipHandler
{
    private readonly IPaymentSlipStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPaymentSlipHandler(IPaymentSlipStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AdminPaymentSlipDto> Handle(GetAdminPaymentSlipQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminPaymentsVerifySlip) is { } authError)
        {
            return Result<AdminPaymentSlipDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAdminPaymentSlip(query.PropertyId, query.SlipId, unmaskPii);
    }
}
