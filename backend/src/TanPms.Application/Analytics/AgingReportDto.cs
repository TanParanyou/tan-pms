namespace TanPms.Application.Analytics;

public sealed record AgingReportDto(
    DateOnly AsOf,
    AgingBucketsDto Totals,
    IReadOnlyList<AgingCustomerRowDto> Customers);
