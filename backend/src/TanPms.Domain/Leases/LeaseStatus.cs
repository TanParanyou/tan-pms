namespace TanPms.Domain.Leases;

public enum LeaseStatus
{
    Draft = 1,
    PendingSignature = 2,
    Active = 3,
    MoveOutNotice = 4,
    MovedOut = 5,
    Terminated = 6,
    Cancelled = 7
}
