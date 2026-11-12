using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

// Builds the session body for a verified subject and mints a fresh access + refresh token pair.
public sealed class AuthSessionIssuer
{
    public const string BearerTokenType = "Bearer";

    private readonly IAuthStore _store;
    private readonly IAccessTokenIssuer _accessTokenIssuer;
    private readonly AuthSecuritySettings _settings;
    private readonly TimeProvider _timeProvider;

    public AuthSessionIssuer(IAuthStore store, IAccessTokenIssuer accessTokenIssuer, AuthSecuritySettings settings, TimeProvider timeProvider)
    {
        _store = store;
        _accessTokenIssuer = accessTokenIssuer;
        _settings = settings;
        _timeProvider = timeProvider;
    }

    public Result<AuthSessionResponse> Issue(string scope, string subjectId, Guid familyId, string? clientIp, string? userAgent, string? rotatedTokenHash = null)
    {
        var session = _store.BuildAuthSession(scope, subjectId);
        if (session.IsFailure || session.Value is null)
        {
            return session;
        }

        var now = _timeProvider.GetUtcNow();
        var access = _accessTokenIssuer.Issue(subjectId, scope);
        var (rawRefresh, refreshHash) = RefreshTokenCodec.Generate();
        var refreshExpiresAt = now.AddDays(_settings.RefreshTokenDays);
        // Claim the presented token first so concurrent refreshes cannot both rotate it.
        if (rotatedTokenHash is not null && !_store.TryRotateRefreshToken(rotatedTokenHash, refreshHash, now))
        {
            return Result<AuthSessionResponse>.Failure(new Error(DomainErrorCodes.RefreshTokenInvalid, "Refresh token is invalid or expired."));
        }

        _store.AddRefreshToken(new RefreshToken
        {
            TokenHash = refreshHash,
            FamilyId = familyId,
            SubjectId = subjectId,
            Scope = scope,
            ExpiresAt = refreshExpiresAt,
            CreatedByIp = Truncate(clientIp, 64),
            UserAgent = Truncate(userAgent, 512)
        });

        return Result<AuthSessionResponse>.Success(session.Value with
        {
            AccessToken = access.Token,
            AccessTokenExpiresAt = access.ExpiresAt,
            RefreshToken = rawRefresh,
            RefreshTokenExpiresAt = refreshExpiresAt,
            TokenType = BearerTokenType
        });
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
