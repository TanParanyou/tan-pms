using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class GiveAdminLeaseMoveOutNoticeHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public GiveAdminLeaseMoveOutNoticeHandler(
        ILeaseStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseItemDto> Handle(GiveAdminLeaseMoveOutNoticeCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseItemDto>.Failure(authError);
        }

        var result = _store.GiveAdminLeaseMoveOutNotice(command.PropertyId, command.LeaseId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesManage,
                entityId: result.Value.Id,
                reason: $"Recorded move-out notice for lease {result.Value.DocumentNumber}",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Status,
                    result.Value.EndDate,
                    result.Value.MonthlyRentAmount
                });
        }

        return result;
    }
}
