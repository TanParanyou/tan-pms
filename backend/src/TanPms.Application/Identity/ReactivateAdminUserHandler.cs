using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class ReactivateAdminUserHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public ReactivateAdminUserHandler(IIdentityStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<AdminUserDto> Handle(ReactivateAdminUserCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminUsersManage) is { } authError)
        {
            return Result<AdminUserDto>.Failure(authError);
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

        var result = _store.SetAdminUserActive(command.UserId, isActive: true);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: result.Value.AllowedProperties[0].Id,
                actionKey: IdentityRules.ReactivateActionKey,
                entityId: result.Value.Id,
                reason: $"Reactivated admin user {result.Value.Username}",
                afterState: new { result.Value.Username, result.Value.IsActive },
                beforeState: new { existing.Value.IsActive });
        }

        return result;
    }
}
