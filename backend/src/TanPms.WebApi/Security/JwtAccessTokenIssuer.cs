using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Identity;

namespace TanPms.WebApi.Security;

// Access tokens carry identity only (sub, scope, jti, iat, exp); permissions and property scope are re-read per request.
public sealed class JwtAccessTokenIssuer : IAccessTokenIssuer
{
    private readonly JwtSettings _settings;
    private readonly TimeProvider _timeProvider;
    private readonly JsonWebTokenHandler _handler = new();

    public JwtAccessTokenIssuer(JwtSettings settings, TimeProvider timeProvider)
    {
        _settings = settings;
        _timeProvider = timeProvider;
    }

    public AccessTokenResult Issue(string subjectId, string scope)
    {
        var now = _timeProvider.GetUtcNow();
        var expiresAt = now.AddMinutes(_settings.AccessTokenMinutes);
        var tokenId = Guid.NewGuid().ToString("N");
        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _settings.Issuer,
            Audience = _settings.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            Subject = new ClaimsIdentity(
            [
                new Claim(AuthClaimNames.Subject, subjectId),
                new Claim(AuthClaimNames.Scope, scope),
                new Claim(AuthClaimNames.TokenId, tokenId)
            ]),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(_settings.SigningKey) { KeyId = _settings.KeyId }, SecurityAlgorithms.HmacSha256)
        });
        return new AccessTokenResult(token, expiresAt, tokenId);
    }
}
