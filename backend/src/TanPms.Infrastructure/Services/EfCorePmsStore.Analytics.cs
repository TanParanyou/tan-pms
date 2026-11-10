using Microsoft.EntityFrameworkCore;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Leases;
using TanPms.Domain.Rates;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

// Analytics on PostgreSQL: rows are filtered to the report window and money is summed/grouped in SQL. Only the parts
// that need per-row rules run in memory, over already-narrowed rows: unit-night expansion for occupancy, per-line VAT
// rounding (grouped by distinct amount/tax mode first) and aging buckets per open invoice. Formulas are identical to
// AnalyticsCalculator, which the in-memory store uses; parity is covered by tests on seeded data.
public sealed partial class EfCorePmsStore
{
    public Result<OccupancyReportDto> GetOccupancyReport(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<OccupancyReportDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var (windowStart, windowEnd) = UtcWindow(from, to);
        // One extra day on each side: a stay's nights are keyed by Bangkok dates of check-in/check-out instants.
        var stayFrom = windowStart.AddDays(-1);
        var stayTo = windowEnd.AddDays(1);
        return Result<OccupancyReportDto>.Success(AnalyticsCalculator.Occupancy(
            from,
            to,
            _dbContext.Units.AsNoTracking().Where(u => u.PropertyId == propertyId).ToList(),
            _dbContext.Buildings.AsNoTracking().Where(b => b.PropertyId == propertyId).ToDictionary(b => b.Id, b => b.Name),
            _dbContext.Leases.AsNoTracking()
                .Where(l => l.PropertyId == propertyId && l.StartDate <= to && l.EndDate >= from
                            && (l.Status == LeaseStatus.Active || l.Status == LeaseStatus.MoveOutNotice || l.Status == LeaseStatus.MovedOut))
                .ToList(),
            _dbContext.Stays.AsNoTracking()
                .Where(s => s.PropertyId == propertyId && s.Status != StayStatus.Cancelled
                            && s.CheckInAt < stayTo
                            && (s.CheckOutAt ?? s.ExpectedCheckOutAt ?? s.CheckInAt) >= stayFrom)
                .ToList()));
    }

    public Result<RevParReportDto> GetRevParReport(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<RevParReportDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var available = _dbContext.Units.AsNoTracking().Count(u => u.PropertyId == propertyId) * (to.DayNumber - from.DayNumber + 1);
        var (windowStart, windowEnd) = UtcWindow(from, to);

        // Room charges of stays checked in within the window, grouped by (amount, tax mode) so VAT is rounded per line exactly
        // like ThaiTaxCalculator while SQL does the counting.
        var folioGroups = (
                from s in _dbContext.Stays.AsNoTracking()
                join f in _dbContext.Folios.AsNoTracking() on s.Id equals f.StayId
                from c in f.Charges
                where s.PropertyId == propertyId && s.Status != StayStatus.Cancelled
                      && s.CheckInAt >= windowStart && s.CheckInAt < windowEnd
                      && !c.IsVoided && c.ChargeCategoryCode == UtilityChargeCategories.ShortStayRoom
                group c by new { c.Amount, c.TaxMode } into g
                select new { g.Key.Amount, g.Key.TaxMode, Count = g.Count() })
            .ToList();
        var folioRevenue = folioGroups.Sum(g => ThaiTaxCalculator.CalculateLine(g.Amount, g.TaxMode).SubTotal * g.Count);

        // Rent lines summed per billing period in SQL, then accrued by the share of the month inside the window.
        var periods = OverlappingPeriods(from, to);
        var rentByPeriod = (
                from i in _dbContext.Invoices.AsNoTracking()
                from l in i.Lines
                where i.PropertyId == propertyId && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Voided
                      && i.BillingPeriodYearMonth != null && periods.Contains(i.BillingPeriodYearMonth)
                      && l.ChargeCategoryCode == UtilityChargeCategories.MonthlyRoomRent
                group l by i.BillingPeriodYearMonth into g
                select new { Period = g.Key, SubTotal = g.Sum(l => l.SubTotal) })
            .ToList();
        var rentRevenue = 0m;
        foreach (var row in rentByPeriod)
        {
            Application.Meters.BillingPeriod.Parse(row.Period, out var periodStart, out var periodEnd);
            var overlapStart = periodStart > from ? periodStart : from;
            var overlapEnd = periodEnd < to ? periodEnd : to;
            rentRevenue += row.SubTotal * (overlapEnd.DayNumber - overlapStart.DayNumber + 1) / (periodEnd.DayNumber - periodStart.DayNumber + 1);
        }

        folioRevenue = decimal.Round(folioRevenue, 2, MidpointRounding.AwayFromZero);
        rentRevenue = decimal.Round(rentRevenue, 2, MidpointRounding.AwayFromZero);
        var roomRevenue = folioRevenue + rentRevenue;
        return Result<RevParReportDto>.Success(new RevParReportDto(
            from,
            to,
            available,
            folioRevenue,
            rentRevenue,
            roomRevenue,
            available == 0 ? 0m : decimal.Round(roomRevenue / available, 2, MidpointRounding.AwayFromZero)));
    }

    public Result<AgingReportDto> GetAgingReport(Guid propertyId, DateOnly asOf, bool unmaskPii = false)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<AgingReportDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        // Totals and paid amounts are aggregated in SQL; only open invoices come back.
        var open = _dbContext.Invoices.AsNoTracking()
            .Where(i => i.PropertyId == propertyId
                        && (i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid || i.Status == InvoiceStatus.Overdue))
            .Select(i => new
            {
                i.CustomerId,
                IssuedOn = i.IssuedAt ?? i.CreatedAt,
                i.DueDate,
                Total = i.Lines.Sum(l => l.NetAmount),
                Paid = _dbContext.Receipts.Where(r => r.InvoiceId == i.Id).Sum(r => (decimal?)r.NetPayableAmount) ?? 0m
            })
            .ToList();
        var customerIds = open.Select(i => i.CustomerId).Distinct().ToList();
        return Result<AgingReportDto>.Success(AnalyticsCalculator.AgingFromRows(
            asOf,
            open.Select(i => new AgingInvoiceRow(i.CustomerId, i.Total - i.Paid, AnalyticsPeriod.LocalDate(i.IssuedOn), i.DueDate)).ToList(),
            _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id),
            unmaskPii));
    }

    public Result<CashierShiftSummaryDto> GetCashierShiftSummary(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<CashierShiftSummaryDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var (windowStart, windowEnd) = UtcWindow(from, to);
        var perCashier = _dbContext.CashierShifts.AsNoTracking()
            .Where(s => s.PropertyId == propertyId && s.CreatedAt >= windowStart && s.CreatedAt < windowEnd)
            .GroupBy(s => s.CashierUserId)
            .Select(g => new
            {
                CashierUserId = g.Key,
                Count = g.Count(),
                Open = g.Count(s => s.Status == CashierShiftStatus.Open),
                Closed = g.Count(s => s.Status == CashierShiftStatus.Closed),
                Reconciled = g.Count(s => s.Status == CashierShiftStatus.Reconciled),
                Cancelled = g.Count(s => s.Status == CashierShiftStatus.Cancelled),
                Receipts = g.Sum(s => s.CashReceiptsInShift),
                DepositsReceived = g.Sum(s => s.CashDepositsReceivedInShift),
                DepositsRefunded = g.Sum(s => s.CashDepositsRefundedInShift),
                Variance = g.Sum(s => s.CashVariance ?? 0m),
                WithVariance = g.Count(s => s.CashVariance != null && s.CashVariance != 0m)
            })
            .ToList();
        var receipts = _dbContext.Receipts.AsNoTracking()
            .Where(r => r.PropertyId == propertyId && r.CreatedAt >= windowStart && r.CreatedAt < windowEnd)
            .GroupBy(r => 1)
            .Select(g => new { Count = g.Count(), Net = g.Sum(r => r.NetPayableAmount) })
            .FirstOrDefault();
        var users = UserRefs();
        return Result<CashierShiftSummaryDto>.Success(new CashierShiftSummaryDto(
            from,
            to,
            perCashier.Sum(c => c.Count),
            perCashier.Sum(c => c.Open),
            perCashier.Sum(c => c.Closed),
            perCashier.Sum(c => c.Reconciled),
            perCashier.Sum(c => c.Cancelled),
            perCashier.Sum(c => c.Receipts),
            perCashier.Sum(c => c.DepositsReceived),
            perCashier.Sum(c => c.DepositsRefunded),
            perCashier.Sum(c => c.Variance),
            perCashier.Sum(c => c.WithVariance),
            receipts?.Count ?? 0,
            receipts?.Net ?? 0m,
            perCashier
                .Select(c => new CashierShiftSummaryRowDto(users(c.CashierUserId)!, c.Count, c.Receipts, c.Variance))
                .OrderBy(r => r.Cashier.Id, StringComparer.Ordinal)
                .ToList()));
    }

    public Result<DepositSummaryDto> GetDepositSummary(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<DepositSummaryDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var (windowStart, windowEnd) = UtcWindow(from, to);
        var ledgerCounts = _dbContext.DepositLedgers.AsNoTracking()
            .Where(l => l.PropertyId == propertyId)
            .GroupBy(l => l.DepositType)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToDictionary(x => x.Type, x => x.Count);
        var movements = (
                from t in _dbContext.DepositTransactions.AsNoTracking()
                join l in _dbContext.DepositLedgers.AsNoTracking() on t.DepositLedgerId equals l.Id
                where l.PropertyId == propertyId
                group t by new { l.DepositType, t.TransactionType, InPeriod = t.CreatedAt >= windowStart && t.CreatedAt < windowEnd } into g
                select new { g.Key.DepositType, g.Key.TransactionType, g.Key.InPeriod, Amount = g.Sum(t => t.Amount) })
            .ToList();

        decimal Sum(DepositType type, Func<DepositTransactionType, bool> txType, bool? inPeriod) =>
            movements.Where(m => m.DepositType == type && txType(m.TransactionType) && (inPeriod is null || m.InPeriod == inPeriod)).Sum(m => m.Amount);

        var byType = Enum.GetValues<DepositType>()
            .Select(type => new DepositTypeSummaryDto(
                type.ToString(),
                ledgerCounts.GetValueOrDefault(type),
                Sum(type, t => t == DepositTransactionType.Received, null) - Sum(type, t => t != DepositTransactionType.Received, null),
                Sum(type, t => t == DepositTransactionType.Received, true),
                Sum(type, t => t is DepositTransactionType.DeductedForDamageOrUtility or DepositTransactionType.Forfeited, true),
                Sum(type, t => t == DepositTransactionType.Refunded, true)))
            .ToList();
        return Result<DepositSummaryDto>.Success(new DepositSummaryDto(from, to, "Liability", byType.Sum(t => t.HeldBalance), byType));
    }

    // Bangkok-local [from, to] dates as a UTC half-open instant window.
    private static (DateTimeOffset Start, DateTimeOffset End) UtcWindow(DateOnly from, DateOnly to) =>
        (new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), AnalyticsPeriod.BangkokOffset).ToUniversalTime(),
         new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), AnalyticsPeriod.BangkokOffset).ToUniversalTime());

    private static List<string> OverlappingPeriods(DateOnly from, DateOnly to)
    {
        var periods = new List<string>();
        for (var month = new DateOnly(from.Year, from.Month, 1); month <= to; month = month.AddMonths(1))
        {
            periods.Add(Application.Meters.BillingPeriod.Format(month));
        }

        return periods;
    }
}
