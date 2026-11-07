using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class SettleAdminLeaseMoveOutHandler
{
    private readonly ILeaseStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public SettleAdminLeaseMoveOutHandler(
        ILeaseStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<LeaseSettlementDto> Handle(SettleAdminLeaseMoveOutCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminLeasesSettleMoveOut) is { } authError)
        {
            return Result<LeaseSettlementDto>.Failure(authError);
        }

        var result = _store.SettleAdminLeaseMoveOut(command.PropertyId, command.LeaseId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminLeasesSettleMoveOut,
                entityId: result.Value.Lease.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new
                {
                    result.Value.Lease.DocumentNumber,
                    result.Value.Lease.Status,
                    command.Request.UtilityDeductionAmount,
                    command.Request.DamageDeductionAmount,
                    result.Value.DeductedAmount,
                    result.Value.RefundedAmount
                });
        }

        return result;
    }
}
