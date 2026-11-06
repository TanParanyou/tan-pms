namespace TanPms.Application.Stays;

public sealed record CheckInStayRequest(
    Guid PropertyId,
    Guid UnitId,
    Guid CustomerId,
    string StayMode,
    decimal KeyDepositAmount,
    bool OverrideDirtyCheckIn = false,
    string? OverrideReason = null);
