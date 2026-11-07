namespace TanPms.Application.Leases;

public sealed record LeaseSettlementDto(
    LeaseItemDto Lease,
    decimal DeductedAmount,
    decimal RefundedAmount,
    string? GeneratedHousekeepingTaskStatus);
