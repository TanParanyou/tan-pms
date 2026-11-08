namespace TanPms.Application.Meters;

public sealed record GetClientUtilityUsageQuery(
    Guid? LeaseId,
    int? Months);
