namespace TanPms.Domain.Reservations;

public enum ReservationStatus
{
    Hold = 1,
    PendingVerification = 2,
    Confirmed = 3,
    CheckedIn = 4,
    Expired = 5,
    Cancelled = 6,
    NoShow = 7
}
