namespace TanPms.Application.Identity;

// Bound from Auth:Lockout:* and Auth:Jwt:RefreshTokenDays.
public sealed record AuthSecuritySettings(
    int LockoutThreshold = 5,
    int LockoutMinutes = 15,
    int RefreshTokenDays = 7);
