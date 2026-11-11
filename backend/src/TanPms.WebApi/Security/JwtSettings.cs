namespace TanPms.WebApi.Security;

public sealed record JwtSettings(
    byte[] SigningKey,
    string Issuer,
    string Audience,
    int AccessTokenMinutes,
    bool RequireHttpsMetadata);
