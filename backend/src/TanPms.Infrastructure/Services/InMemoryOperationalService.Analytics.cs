using TanPms.Application.Analytics;
using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    public Result<OccupancyReportDto> GetOccupancyReport(Guid propertyId, DateOnly from, DateOnly to) =>
        WithProperty(propertyId, () => AnalyticsCalculator.Occupancy(
            from,
            to,
            _units.Values.Where(u => u.PropertyId == propertyId).ToList(),
            _buildings.Values.Where(b => b.PropertyId == propertyId).ToDictionary(b => b.Id, b => b.Name),
            _leases.Where(l => l.PropertyId == propertyId).ToList(),
            _stays.Where(s => s.PropertyId == propertyId).ToList()));

    public Result<RevParReportDto> GetRevParReport(Guid propertyId, DateOnly from, DateOnly to) =>
        WithProperty(propertyId, () => AnalyticsCalculator.RevPar(
            from,
            to,
            _units.Values.Count(u => u.PropertyId == propertyId),
            _stays.Where(s => s.PropertyId == propertyId).Select(s => (s, _foliosByStayId.GetValueOrDefault(s.Id))).ToList(),
            _invoices.Where(i => i.PropertyId == propertyId).ToList()));

    public Result<AgingReportDto> GetAgingReport(Guid propertyId, DateOnly asOf, bool unmaskPii = false) =>
        WithProperty(propertyId, () => AnalyticsCalculator.Aging(
            asOf,
            _invoices.Where(i => i.PropertyId == propertyId).ToList(),
            _receipts.Where(r => r.PropertyId == propertyId).ToList(),
            _customers,
            unmaskPii));

    public Result<CashierShiftSummaryDto> GetCashierShiftSummary(Guid propertyId, DateOnly from, DateOnly to) =>
        WithProperty(propertyId, () => AnalyticsCalculator.CashierShiftSummary(
            from,
            to,
            _cashierShifts.Where(s => s.PropertyId == propertyId).ToList(),
            _receipts.Where(r => r.PropertyId == propertyId).ToList(),
            UserRefsLocked()));

    public Result<DepositSummaryDto> GetDepositSummary(Guid propertyId, DateOnly from, DateOnly to) =>
        WithProperty(propertyId, () => AnalyticsCalculator.DepositSummary(
            from,
            to,
            _depositLedgers.Where(l => l.PropertyId == propertyId).ToList()));

    private Result<T> WithProperty<T>(Guid propertyId, Func<T> build)
    {
        lock (_syncRoot)
        {
            return _properties.ContainsKey(propertyId)
                ? Result<T>.Success(build())
                : Result<T>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }
    }
}
