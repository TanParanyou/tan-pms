using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Meters;

public sealed class GetAdminMeterReadingSheetHandler
{
    private readonly IMeterReadingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminMeterReadingSheetHandler(IMeterReadingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<MeterReadingSheetResponse> Handle(GetAdminMeterReadingSheetQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminMetersRecord,
            PermissionKeys.AdminBillingIssueBatch) is { } authError)
        {
            return Result<MeterReadingSheetResponse>.Failure(authError);
        }

        return _store.GetAdminMeterReadingSheet(query.PropertyId, query.Period, query.BuildingId);
    }
}
