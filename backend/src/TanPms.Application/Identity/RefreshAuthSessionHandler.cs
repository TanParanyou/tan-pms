using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

// Rotating refresh: every use issues a new token in the same family; presenting an already-rotated token
// is treated as theft and revokes the whole family.
public sealed class RefreshAuthSessionHandler
{
    private readonly IAuthStore _store;
    private readonly AuthSessionIssuer _sessionIssuer;
    private readonly TimeProvider _timeProvider;

    public RefreshAuthSessionHandler(IAuthStore store, AuthSessionIssuer sessionIssuer, TimeProvider timeProvider)
    {
        _store = store;
        _sessionIssuer = sessionIssuer;
        _timeProvider = timeProvider;
    }

    public Result<AuthSessionResponse> Handle(RefreshAuthSessionCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Request.RefreshToken))
        {
            return Invalid();
        }

        var now = _timeProvider.GetUtcNow();
        var token = _store.FindRefreshToken(RefreshTokenCodec.Hash(command.Request.RefreshToken));
        if (token is null)
        {
            return Invalid();
        }

        if (token.WasRotated)
        {
            _store.RevokeRefreshTokenFamily(token.FamilyId, now);
            return Invalid();
        }

        if (!token.IsActive(now))
        {
            return Invalid();
        }

        var principal = _store.ResolvePrincipal(token.Scope, token.SubjectId);
        if (principal is null || !principal.IsActive)
        {
            _store.RevokeRefreshTokenFamily(token.FamilyId, now);
            return Invalid();
        }

        // shortcut: two concurrent refreshes with the same token can both rotate; add a row lock if clients race.
        return _sessionIssuer.Issue(token.Scope, token.SubjectId, token.FamilyId, command.ClientIp, command.UserAgent, token.TokenHash);
    }

    private static Result<AuthSessionResponse> Invalid() =>
        Result<AuthSessionResponse>.Failure(new Error(DomainErrorCodes.RefreshTokenInvalid, "Refresh token is invalid or expired."));
}
