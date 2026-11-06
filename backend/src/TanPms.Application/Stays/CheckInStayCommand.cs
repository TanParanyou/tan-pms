namespace TanPms.Application.Stays;

public sealed record CheckInStayCommand(
    Guid PropertyId,
    Guid UnitId,
    Guid CustomerId,
    string StayMode,
    decimal KeyDepositAmount,
    bool OverrideDirtyCheckIn = false,
    string? OverrideReason = null);
