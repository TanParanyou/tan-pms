using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class DeactivateAdminUserHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeactivateAdminUserHandler(IIdentityStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<AdminUserDto> Handle(DeactivateAdminUserCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminUsersManage) is { } authError)
        {
            return Result<AdminUserDto>.Failure(authError);
        }

        if (command.Request.Validate() is { } reasonError)
        {
            return Result<AdminUserDto>.Failure(reasonError);
        }

        if (IdentityRules.CheckNotSelf(_currentUser, command.UserId) is { } selfError)
        {
            return Result<AdminUserDto>.Failure(selfError);
        }

        var existing = _store.GetAdminUser(command.UserId);
        if (existing.IsFailure || existing.Value is null)
        {
            return existing;
        }

        if (IdentityRules.CheckCoversUser(_currentUser, existing.Value) is { } scopeError)
        {
            return Result<AdminUserDto>.Failure(scopeError);
        }

        var result = _store.SetAdminUserActive(command.UserId, isActive: false);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.AllowedProperties[0].Id,
                actionKey: IdentityRules.DeactivateActionKey,
                entityId: result.Value.Id,
                reason: command.Request.Reason.Trim(),
                afterState: new { result.Value.Username, result.Value.IsActive },
                beforeState: new { existing.Value.IsActive });
        }

        return result;
    }
}
