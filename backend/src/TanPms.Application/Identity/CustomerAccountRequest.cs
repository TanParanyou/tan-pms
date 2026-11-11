namespace TanPms.Application.Identity;

public sealed record CustomerAccountRequest(
    string LoginIdentifier,
    string InitialPassword);
