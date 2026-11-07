using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class UpsertAdminRatePlanHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminRatePlanHandler(
        IRateCatalogStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<RatePlanItemDto> Handle(UpsertAdminRatePlanCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminRatesManage) is { } authError)
        {
            return Result<RatePlanItemDto>.Failure(authError);
        }

        var result = _store.UpsertRatePlan(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminRatesManage,
                entityId: result.Value.Id,
                reason: $"Upserted rate plan {result.Value.Code}",
                afterState: new
                {
                    result.Value.Code,
                    HourlyBase = result.Value.HourlyPackage.BasePackagePrice,
                    DailyWeekday = result.Value.DailyRate.WeekdayRate,
                    MonthlyRent = result.Value.MonthlyRate.MonthlyRentRate
                });
        }

        return result;
    }
}
