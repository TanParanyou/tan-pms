namespace TanPms.Application.Reservations;

public sealed record CreateAdminReservationRequest(
    Guid CustomerId,
    Guid UnitTypeId,
    Guid? UnitId,
    string StayMode,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt,
    decimal DepositAmount,
    bool ConfirmImmediately);
