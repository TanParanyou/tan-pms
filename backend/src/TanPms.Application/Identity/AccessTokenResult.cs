namespace TanPms.Application.Identity;

public sealed record AccessTokenResult(
    string Token,
    DateTimeOffset ExpiresAt,
    string TokenId);
