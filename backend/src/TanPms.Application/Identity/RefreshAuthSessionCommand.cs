namespace TanPms.Application.Identity;

public sealed record RefreshAuthSessionCommand(
    RefreshSessionRequest Request,
    string? ClientIp = null,
    string? UserAgent = null);
