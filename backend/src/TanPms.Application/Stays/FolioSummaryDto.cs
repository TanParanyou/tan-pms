namespace TanPms.Application.Stays;

public sealed record FolioSummaryDto(
    Guid Id,
    IReadOnlyList<FolioChargeItemDto> Charges,
    decimal TotalCharges,
    decimal TotalPayments,
    decimal BalanceDue);
