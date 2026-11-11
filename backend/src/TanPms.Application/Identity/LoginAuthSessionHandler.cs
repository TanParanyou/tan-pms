using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class LoginAuthSessionHandler
{
    private readonly IAuthStore _store;
    private readonly IPasswordHasher _passwordHasher;
    private readonly AuthSessionIssuer _sessionIssuer;
    private readonly AuthSecuritySettings _settings;
    private readonly TimeProvider _timeProvider;

    public LoginAuthSessionHandler(
        IAuthStore store,
        IPasswordHasher passwordHasher,
        AuthSessionIssuer sessionIssuer,
        AuthSecuritySettings settings,
        TimeProvider timeProvider)
    {
        _store = store;
        _passwordHasher = passwordHasher;
        _sessionIssuer = sessionIssuer;
        _settings = settings;
        _timeProvider = timeProvider;
    }

    public Result<AuthSessionResponse> Handle(LoginAuthSessionCommand command)
    {
        var scope = AuthScopes.Parse(command.Scope);
        if (scope is null || string.IsNullOrWhiteSpace(command.Identifier))
        {
            return Result<AuthSessionResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Scope (admin|client) and identifier are required."));
        }

        var password = command.Password ?? string.Empty;
        var identifier = scope == AuthScopes.Client
            ? LoginIdentifierNormalizer.Normalize(command.Identifier)
            : command.Identifier.Trim();
        var credential = _store.FindCredential(scope, identifier);
        var now = _timeProvider.GetUtcNow();

        // Unknown, password-less and locked accounts all burn one hash verification and return the same error.
        if (credential?.PasswordHash is null || credential.LockedUntil > now)
        {
            _passwordHasher.VerifyDummy(password);
            return InvalidCredentials();
        }

        if (!_passwordHasher.Verify(password, credential.PasswordHash))
        {
            _store.RecordLoginFailure(scope, credential.SubjectId, now, _settings.LockoutThreshold, TimeSpan.FromMinutes(_settings.LockoutMinutes));
            return InvalidCredentials();
        }

        if (!credential.IsActive)
        {
            return InvalidCredentials();
        }

        _store.RecordLoginSuccess(scope, credential.SubjectId);
        return _sessionIssuer.Issue(scope, credential.SubjectId, Guid.NewGuid(), command.ClientIp, command.UserAgent);
    }

    private static Result<AuthSessionResponse> InvalidCredentials() =>
        Result<AuthSessionResponse>.Failure(new Error(DomainErrorCodes.InvalidCredentials, "Invalid username or password."));
}
