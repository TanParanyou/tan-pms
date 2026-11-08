using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Analytics;

public sealed class GetAdminAgingReportHandler
{
    private readonly IAnalyticsStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminAgingReportHandler(IAnalyticsStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AgingReportDto> Handle(GetAdminAgingReportQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminAnalyticsRead) is { } authError)
        {
            return Result<AgingReportDto>.Failure(authError);
        }

        if (AnalyticsPeriod.Resolve(query.From, query.To, AnalyticsPeriod.Today(), out var from, out var to) is { } periodError)
        {
            return Result<AgingReportDto>.Failure(periodError);
        }

        // Aging is a point-in-time report as of "to"; "from" only participates in validation.
        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        return _store.GetAgingReport(query.PropertyId, to, unmaskPii);
    }
}
