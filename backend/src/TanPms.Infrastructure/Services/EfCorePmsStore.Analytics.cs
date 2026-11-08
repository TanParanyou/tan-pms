using Microsoft.EntityFrameworkCore;
using TanPms.Application.Analytics;
using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;

namespace TanPms.Infrastructure.Services;

// Rows are gathered with EF; all report math lives in AnalyticsCalculator (shared with the in-memory store).
// shortcut: loads the property's rows into memory; move hot reports to Dapper aggregates if a property grows past ~10k stays/invoices.
public sealed partial class EfCorePmsStore
{
    public Result<OccupancyReportDto> GetOccupancyReport(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<OccupancyReportDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        return Result<OccupancyReportDto>.Success(AnalyticsCalculator.Occupancy(
            from,
            to,
            _dbContext.Units.AsNoTracking().Where(u => u.PropertyId == propertyId).ToList(),
            _dbContext.Buildings.AsNoTracking().Where(b => b.PropertyId == propertyId).ToDictionary(b => b.Id, b => b.Name),
            _dbContext.Leases.AsNoTracking().Where(l => l.PropertyId == propertyId).ToList(),
            _dbContext.Stays.AsNoTracking().Where(s => s.PropertyId == propertyId).ToList()));
    }

    public Result<RevParReportDto> GetRevParReport(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<RevParReportDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var folios = _dbContext.Folios.AsNoTracking().Include(f => f.Charges).Where(f => f.PropertyId == propertyId).ToDictionary(f => f.StayId);
        var stays = _dbContext.Stays.AsNoTracking().Where(s => s.PropertyId == propertyId).ToList()
            .Select(s => (s, folios.GetValueOrDefault(s.Id)))
            .ToList();
        var invoices = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines)
            .Where(i => i.PropertyId == propertyId && i.BillingPeriodYearMonth != null && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Voided)
            .ToList();
        return Result<RevParReportDto>.Success(AnalyticsCalculator.RevPar(
            from, to, _dbContext.Units.AsNoTracking().Count(u => u.PropertyId == propertyId), stays, invoices));
    }

    public Result<AgingReportDto> GetAgingReport(Guid propertyId, DateOnly asOf, bool unmaskPii = false)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<AgingReportDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var invoices = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines)
            .Where(i => i.PropertyId == propertyId
                        && (i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid || i.Status == InvoiceStatus.Overdue))
            .ToList();
        var invoiceIds = invoices.Select(i => i.Id).ToList();
        var customerIds = invoices.Select(i => i.CustomerId).Distinct().ToList();
        return Result<AgingReportDto>.Success(AnalyticsCalculator.Aging(
            asOf,
            invoices,
            _dbContext.Receipts.AsNoTracking().Where(r => invoiceIds.Contains(r.InvoiceId)).ToList(),
            _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id),
            unmaskPii));
    }

    public Result<CashierShiftSummaryDto> GetCashierShiftSummary(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<CashierShiftSummaryDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        return Result<CashierShiftSummaryDto>.Success(AnalyticsCalculator.CashierShiftSummary(
            from,
            to,
            _dbContext.CashierShifts.AsNoTracking().Where(s => s.PropertyId == propertyId).ToList(),
            _dbContext.Receipts.AsNoTracking().Where(r => r.PropertyId == propertyId).ToList(),
            UserRefs()));
    }

    public Result<DepositSummaryDto> GetDepositSummary(Guid propertyId, DateOnly from, DateOnly to)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<DepositSummaryDto>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        return Result<DepositSummaryDto>.Success(AnalyticsCalculator.DepositSummary(
            from,
            to,
            _dbContext.DepositLedgers.AsNoTracking().Include(l => l.Transactions).Where(l => l.PropertyId == propertyId).ToList()));
    }
}
