using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

public sealed class ChangePasswordHandler
{
    public const string ActionKey = "auth.password.change";

    private readonly ICurrentUserContext _currentUser;
    private readonly IAuthStore _store;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditLogger _auditLogger;
    private readonly TimeProvider _timeProvider;

    public ChangePasswordHandler(ICurrentUserContext currentUser, IAuthStore store, IPasswordHasher passwordHasher, IAuditLogger auditLogger, TimeProvider timeProvider)
    {
        _currentUser = currentUser;
        _store = store;
        _passwordHasher = passwordHasher;
        _auditLogger = auditLogger;
        _timeProvider = timeProvider;
    }

    public Result<bool> Handle(ChangePasswordCommand command)
    {
        if (string.IsNullOrWhiteSpace(_currentUser.UserId) || (!_currentUser.IsAdminScope && !_currentUser.IsClientScope))
        {
            return Result<bool>.Failure(new Error(DomainErrorCodes.Unauthenticated, "Caller is not authenticated."));
        }

        var scope = _currentUser.IsAdminScope ? AuthScopes.Admin : AuthScopes.Client;
        var credential = _store.FindCredentialBySubject(scope, _currentUser.UserId);
        if (credential?.PasswordHash is null || !_passwordHasher.Verify(command.Request.CurrentPassword ?? string.Empty, credential.PasswordHash))
        {
            return Result<bool>.Failure(new Error(DomainErrorCodes.InvalidCredentials, "Current password is incorrect."));
        }

        if (PasswordPolicy.Validate(command.Request.NewPassword) is { } policyError)
        {
            return Result<bool>.Failure(policyError);
        }

        var now = _timeProvider.GetUtcNow();
        var result = _store.SetPassword(scope, credential.SubjectId, _passwordHasher.Hash(command.Request.NewPassword), now);
        if (result.IsFailure)
        {
            return result;
        }

        var revoked = _store.RevokeAllRefreshTokens(scope, credential.SubjectId, now);
        _auditLogger.RecordMutation(
            propertyId: _currentUser.IsAdminScope ? _currentUser.AllowedPropertyIds.FirstOrDefault() : Guid.Empty,
            actionKey: ActionKey,
            entityId: _currentUser.CustomerId ?? (Guid.TryParse(credential.SubjectId, out var id) ? id : Guid.Empty),
            reason: "Password changed by its owner",
            afterState: new { SubjectId = credential.SubjectId, Scope = scope, RevokedSessions = revoked });
        return Result<bool>.Success(true);
    }
}
