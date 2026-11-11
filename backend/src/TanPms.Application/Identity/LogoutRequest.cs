namespace TanPms.Application.Identity;

public sealed record LogoutRequest(
    string? RefreshToken = null);
