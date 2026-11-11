namespace TanPms.Application.Identity;

public sealed record LoginAuthSessionCommand(
    string Scope,
    string Identifier,
    string Password,
    string? ClientIp = null,
    string? UserAgent = null);
