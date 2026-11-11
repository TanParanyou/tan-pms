using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

// Same authority rules as deactivate: AdminUsersManage, caller covers every property of the target, never self.
public sealed class ResetAdminUserPasswordHandler
{
    public const string ActionKey = "admin.users.reset_password";

    private readonly IIdentityStore _identityStore;
    private readonly IAuthStore _authStore;
    private readonly ICurrentUserContext _currentUser;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditLogger _auditLogger;
    private readonly TimeProvider _timeProvider;

    public ResetAdminUserPasswordHandler(
        IIdentityStore identityStore,
        IAuthStore authStore,
        ICurrentUserContext currentUser,
        IPasswordHasher passwordHasher,
        IAuditLogger auditLogger,
        TimeProvider timeProvider)
    {
        _identityStore = identityStore;
        _authStore = authStore;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _auditLogger = auditLogger;
        _timeProvider = timeProvider;
    }

    public Result<AdminUserDto> Handle(ResetAdminUserPasswordCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminUsersManage) is { } authError)
        {
            return Result<AdminUserDto>.Failure(authError);
        }

        if (string.Equals(_currentUser.UserId, command.UserId.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            return Result<AdminUserDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Use change-password to change your own password."));
        }

        var existing = _identityStore.GetAdminUser(command.UserId);
        if (existing.IsFailure || existing.Value is null)
        {
            return existing;
        }

        if (IdentityRules.CheckCoversUser(_currentUser, existing.Value) is { } scopeError)
        {
            return Result<AdminUserDto>.Failure(scopeError);
        }

        if (PasswordPolicy.Validate(command.Request.NewPassword) is { } policyError)
        {
            return Result<AdminUserDto>.Failure(policyError);
        }

        var now = _timeProvider.GetUtcNow();
        var subjectId = command.UserId.ToString();
        var set = _authStore.SetPassword(AuthScopes.Admin, subjectId, _passwordHasher.Hash(command.Request.NewPassword), now);
        if (set.IsFailure)
        {
            return Result<AdminUserDto>.Failure(set.Error);
        }

        var revoked = _authStore.RevokeAllRefreshTokens(AuthScopes.Admin, subjectId, now);
        _auditLogger.RecordMutation(
            propertyId: existing.Value.AllowedProperties[0].Id,
            actionKey: ActionKey,
            entityId: command.UserId,
            reason: $"Password reset for {existing.Value.Username}",
            afterState: new { existing.Value.Username, RevokedSessions = revoked });
        return existing;
    }
}
