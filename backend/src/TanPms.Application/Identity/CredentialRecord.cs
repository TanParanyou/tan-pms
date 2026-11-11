namespace TanPms.Application.Identity;

public sealed record CredentialRecord(
    string SubjectId,
    string Scope,
    string? PasswordHash,
    bool IsActive,
    DateTimeOffset? LockedUntil);
