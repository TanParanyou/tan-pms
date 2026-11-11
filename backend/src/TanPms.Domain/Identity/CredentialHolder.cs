using TanPms.Domain.Common;

namespace TanPms.Domain.Identity;

// Password + lockout state shared by admin users and client (customer) accounts. Only the hash is ever stored.
public abstract class CredentialHolder : AuditableEntity
{
    public string? PasswordHash { get; private set; }
    public DateTimeOffset? PasswordChangedAt { get; private set; }
    public int FailedLoginCount { get; private set; }
    public DateTimeOffset? LockedUntil { get; private set; }

    public bool IsLockedOut(DateTimeOffset nowUtc) => LockedUntil is { } until && until > nowUtc;

    public void SetPasswordHash(string passwordHash, DateTimeOffset changedAt)
    {
        PasswordHash = passwordHash;
        PasswordChangedAt = changedAt;
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    // After `threshold` consecutive failures the account is locked for `lockout`; the counter restarts afterwards.
    public void RegisterFailedLogin(DateTimeOffset nowUtc, int threshold, TimeSpan lockout)
    {
        FailedLoginCount++;
        if (FailedLoginCount >= threshold)
        {
            LockedUntil = nowUtc.Add(lockout);
            FailedLoginCount = 0;
        }
    }

    public void RegisterSuccessfulLogin()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }
}
