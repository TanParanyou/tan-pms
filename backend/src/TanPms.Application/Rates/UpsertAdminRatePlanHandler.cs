using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class UpsertAdminRatePlanHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminRatePlanHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<RatePlanItemDto> Handle(UpsertAdminRatePlanCommand command)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminRatesManage))
        {
            return Result<RatePlanItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminRatesManage}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<RatePlanItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
        }

        var result = _store.UpsertRatePlan(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminRatesManage,
                EntityId = result.Value.Id,
                Reason = $"Upserted rate plan {result.Value.Code}",
                AfterStateJson = $"{{\"code\":\"{result.Value.Code}\",\"hourlyBase\":{result.Value.HourlyPackage.BasePackagePrice},\"dailyWeekday\":{result.Value.DailyRate.WeekdayRate},\"monthlyRent\":{result.Value.MonthlyRate.MonthlyRentRate}}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
