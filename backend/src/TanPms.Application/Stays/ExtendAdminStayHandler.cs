using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class ExtendAdminStayHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ExtendAdminStayHandler(
        IStayStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StayDetailDto> Handle(ExtendAdminStayCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminStayCheckIn) is { } authError)
        {
            return Result<StayDetailDto>.Failure(authError);
        }

        var result = _store.ExtendAdminStay(command.PropertyId, command.StayId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminStayCheckIn,
                entityId: result.Value.Id,
                reason: $"Extended stay {result.Value.DocumentNumber} by {command.Request.AdditionalHours}h",
                afterState: new
                {
                    result.Value.DocumentNumber,
                    result.Value.ExpectedCheckOutAt
                });
        }

        return result;
    }
}
