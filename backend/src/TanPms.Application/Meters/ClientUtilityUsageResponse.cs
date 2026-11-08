namespace TanPms.Application.Meters;

public sealed record ClientUtilityUsageResponse(
    Guid LeaseId,
    string LeaseDocumentNumber,
    IReadOnlyList<UtilityUsageMonthDto> Months);
