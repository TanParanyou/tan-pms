namespace TanPms.Application.Identity;

public sealed record LoginRequest(
    string Scope,
    string Identifier,
    string Password);
