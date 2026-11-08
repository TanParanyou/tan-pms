using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class CreateAdminLeaseHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public CreateAdminLeaseHandler(
        ILeaseStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseItemDto> Handle(CreateAdminLeaseCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<LeaseItemDto>.Failure(authError);
        }

        var result = _store.CreateAdminLease(command.PropertyId, command.Request, cashierUserId: _currentUser.UserId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesManage,
                entityId: result.Value.Id,
                reason: $"Created lease {result.Value.DocumentNumber} for unit {result.Value.Unit.UnitNumber}",
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
