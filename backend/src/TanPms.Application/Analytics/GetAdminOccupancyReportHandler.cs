using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Analytics;

public sealed class GetAdminOccupancyReportHandler
{
    private readonly IAnalyticsStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminOccupancyReportHandler(IAnalyticsStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<OccupancyReportDto> Handle(GetAdminOccupancyReportQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminAnalyticsRead) is { } authError)
        {
            return Result<OccupancyReportDto>.Failure(authError);
        }

        if (AnalyticsPeriod.Resolve(query.From, query.To, AnalyticsPeriod.Today(), out var from, out var to) is { } periodError)
        {
            return Result<OccupancyReportDto>.Failure(periodError);
        }

        return _store.GetOccupancyReport(query.PropertyId, from, to);
    }
}
