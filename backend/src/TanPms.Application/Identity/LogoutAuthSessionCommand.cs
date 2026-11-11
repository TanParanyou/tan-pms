namespace TanPms.Application.Identity;

public sealed record LogoutAuthSessionCommand(
    string? RefreshToken = null);
