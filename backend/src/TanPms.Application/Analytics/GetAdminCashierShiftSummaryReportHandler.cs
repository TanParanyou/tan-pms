using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Analytics;

public sealed class GetAdminCashierShiftSummaryReportHandler
{
    private readonly IAnalyticsStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminCashierShiftSummaryReportHandler(IAnalyticsStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<CashierShiftSummaryDto> Handle(GetAdminCashierShiftSummaryReportQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminAnalyticsRead) is { } authError)
        {
            return Result<CashierShiftSummaryDto>.Failure(authError);
        }

        if (AnalyticsPeriod.Resolve(query.From, query.To, AnalyticsPeriod.Today(), out var from, out var to) is { } periodError)
        {
            return Result<CashierShiftSummaryDto>.Failure(periodError);
        }

        return _store.GetCashierShiftSummary(query.PropertyId, from, to);
    }
}
