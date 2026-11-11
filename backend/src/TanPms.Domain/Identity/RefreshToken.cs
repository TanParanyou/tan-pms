using TanPms.Domain.Common;

namespace TanPms.Domain.Identity;

// Server-side refresh session. Only the SHA-256 hash of the random token is stored; rotation chains tokens of one
// login into a family so reuse of an already-rotated token can revoke the whole family.
public sealed class RefreshToken : AuditableEntity
{
    public required string TokenHash { get; init; }
    public required Guid FamilyId { get; init; }
    public required string SubjectId { get; init; }
    public required string Scope { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public string? ReplacedByTokenHash { get; private set; }
    public string? CreatedByIp { get; init; }
    public string? UserAgent { get; init; }

    public bool IsActive(DateTimeOffset nowUtc) => RevokedAt is null && ExpiresAt > nowUtc;

    public bool WasRotated => ReplacedByTokenHash is not null;

    public void Revoke(DateTimeOffset nowUtc, string? replacedByTokenHash = null)
    {
        RevokedAt ??= nowUtc;
        ReplacedByTokenHash ??= replacedByTokenHash;
    }
}
