using TanPms.Application.Common.Results;

namespace TanPms.Application.Analytics;

public interface IAnalyticsStore
{
    Result<OccupancyReportDto> GetOccupancyReport(Guid propertyId, DateOnly from, DateOnly to);

    Result<RevParReportDto> GetRevParReport(Guid propertyId, DateOnly from, DateOnly to);

    Result<AgingReportDto> GetAgingReport(Guid propertyId, DateOnly asOf, bool unmaskPii = false);

    Result<CashierShiftSummaryDto> GetCashierShiftSummary(Guid propertyId, DateOnly from, DateOnly to);

    Result<DepositSummaryDto> GetDepositSummary(Guid propertyId, DateOnly from, DateOnly to);
}
