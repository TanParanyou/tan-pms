using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class VoidAdminFolioChargeHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public VoidAdminFolioChargeHandler(IStayStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(VoidAdminFolioChargeCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckOut) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        var result = _store.VoidAdminFolioCharge(command.PropertyId, command.StayId, command.ChargeId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckOut,
                entityId: command.ChargeId,
                reason: command.Request.Reason.Trim(),
                afterState: new { result.Value.DocumentNumber, result.Value.Folio.TotalCharges, result.Value.Folio.BalanceDue });
        }

        return result;
    }
}
