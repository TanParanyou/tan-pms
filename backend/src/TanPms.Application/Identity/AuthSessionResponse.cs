using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Identity;

public sealed record AuthSessionResponse(
    string UserId,
    string Scope,
    string DisplayName,
    string RoleCode,
    LocalizedTextDto RoleName,
    IReadOnlyList<PropertyRefDto> AllowedProperties,
    IReadOnlyList<string> Permissions,
    CustomerRefDto? Customer,
    string AccessToken,
    DateTimeOffset? AccessTokenExpiresAt = null,
    string? RefreshToken = null,
    DateTimeOffset? RefreshTokenExpiresAt = null,
    string? TokenType = null);
