using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Analytics;

public sealed class GetAdminRevParReportHandler
{
    private readonly IAnalyticsStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminRevParReportHandler(IAnalyticsStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RevParReportDto> Handle(GetAdminRevParReportQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminAnalyticsRead) is { } authError)
        {
            return Result<RevParReportDto>.Failure(authError);
        }

        if (AnalyticsPeriod.Resolve(query.From, query.To, AnalyticsPeriod.Today(), out var from, out var to) is { } periodError)
        {
            return Result<RevParReportDto>.Failure(periodError);
        }

        return _store.GetRevParReport(query.PropertyId, from, to);
    }
}
