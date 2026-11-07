using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class AddAdminFolioChargeHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public AddAdminFolioChargeHandler(
        IStayStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(AddAdminFolioChargeCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckIn,
            PermissionKeys.AdminStayCheckOut) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        var result = _store.AddAdminFolioCharge(command.PropertyId, command.StayId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckIn,
                entityId: result.Value.Id,
                reason: $"Posted charge {command.Request.Amount:0.00} to stay {result.Value.DocumentNumber}",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.Folio.BalanceDue
                });
        }

        return result;
    }
}
