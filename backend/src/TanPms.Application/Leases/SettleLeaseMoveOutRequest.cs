namespace TanPms.Application.Leases;

public sealed record SettleLeaseMoveOutRequest(
    decimal UtilityDeductionAmount,
    decimal DamageDeductionAmount,
    string Reason);
