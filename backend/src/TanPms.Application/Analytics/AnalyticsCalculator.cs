using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Leases;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;
using TanPms.Domain.Stays;

namespace TanPms.Application.Analytics;

// Pure report math shared by the EF Core and in-memory stores (they only gather rows), so both return identical numbers.
public static class AnalyticsCalculator
{
    // Occupancy Rate = Occupied unit-nights / Available unit-nights.
    // Available unit-nights = units in the property x nights in [from, to] (inclusive, Bangkok dates).
    // A unit-night d is occupied by:
    //   - a Lease (Monthly) when StartDate <= d <= EndDate while Active/MoveOutNotice; a MovedOut lease counts only up to
    //     its recorded move-out date (UpdatedAt) because EndDate is not shortened on move-out;
    //   - a Stay (Hourly/Daily, not Cancelled) for nights CheckInDate <= d < CheckOutDate, minimum one night on the
    //     check-in date (day-use/hourly stays occupy that night).
    // When sources overlap on the same unit-night it is counted once with priority Monthly > Daily > Hourly.
    public static OccupancyReportDto Occupancy(
        DateOnly from,
        DateOnly to,
        IReadOnlyList<Unit> units,
        IReadOnlyDictionary<Guid, LocalizedText> buildingNames,
        IReadOnlyList<Lease> leases,
        IReadOnlyList<Stay> stays)
    {
        var nights = to.DayNumber - from.DayNumber + 1;
        var occupied = units.ToDictionary(u => u.Id, _ => new Dictionary<DateOnly, StayMode>());

        void Mark(Guid unitId, DateOnly firstNight, DateOnly lastNightInclusive, StayMode mode)
        {
            if (!occupied.TryGetValue(unitId, out var nightsOfUnit))
            {
                return;
            }

            var start = firstNight > from ? firstNight : from;
            var end = lastNightInclusive < to ? lastNightInclusive : to;
            for (var d = start; d <= end; d = d.AddDays(1))
            {
                if (!nightsOfUnit.TryGetValue(d, out var existing) || Priority(mode) > Priority(existing))
                {
                    nightsOfUnit[d] = mode;
                }
            }
        }

        foreach (var lease in leases)
        {
            var lastNight = lease.Status switch
            {
                LeaseStatus.Active or LeaseStatus.MoveOutNotice => lease.EndDate,
                LeaseStatus.MovedOut when lease.UpdatedAt is { } movedOutAt => Min(lease.EndDate, AnalyticsPeriod.LocalDate(movedOutAt)),
                _ => (DateOnly?)null
            };
            if (lastNight is { } last)
            {
                Mark(lease.UnitId, lease.StartDate, last, StayMode.Monthly);
            }
        }

        foreach (var stay in stays.Where(s => s.Status != StayStatus.Cancelled && s.StayMode != StayMode.Monthly))
        {
            var checkInDate = AnalyticsPeriod.LocalDate(stay.CheckInAt);
            var checkOutDate = (stay.CheckOutAt ?? stay.ExpectedCheckOutAt) is { } checkOut ? AnalyticsPeriod.LocalDate(checkOut) : checkInDate;
            var lastNight = checkOutDate > checkInDate ? checkOutDate.AddDays(-1) : checkInDate;
            Mark(stay.UnitId, checkInDate, lastNight, stay.StayMode);
        }

        var available = units.Count * nights;
        var totalOccupied = occupied.Values.Sum(n => n.Count);
        var byMode = new[] { StayMode.Hourly, StayMode.Daily, StayMode.Monthly }
            .Select(mode =>
            {
                var count = occupied.Values.Sum(n => n.Values.Count(m => m == mode));
                return new OccupancyByStayModeDto(mode.ToString(), count, Rate(count, available));
            })
            .ToList();
        var byBuilding = units
            .GroupBy(u => u.BuildingId)
            .Select(g =>
            {
                var buildingAvailable = g.Count() * nights;
                var buildingOccupied = g.Sum(u => occupied[u.Id].Count);
                return new OccupancyByBuildingDto(
                    g.Key,
                    LocalizedTextDto.FromDomain(buildingNames[g.Key]),
                    g.Count(),
                    buildingAvailable,
                    buildingOccupied,
                    Rate(buildingOccupied, buildingAvailable));
            })
            .OrderBy(b => b.BuildingName.Th, StringComparer.Ordinal)
            .ToList();

        return new OccupancyReportDto(from, to, nights, units.Count, available, totalOccupied, Rate(totalOccupied, available), byMode, byBuilding);
    }

    // RevPAR = Room revenue (ex-VAT) / Available unit-nights.
    // Room revenue = (a) short-stay folio charges tagged SHORT_STAY_ROOM of stays checked in within the range, plus
    // (b) MONTHLY_ROOM_RENT invoice lines of issued (non-Draft, non-Voided) invoices, accrued by the share of the billing
    //     month that falls inside the range: SubTotal x overlapDays / daysInMonth.
    // Deposits, utilities, repairs and other charges are not room revenue.
    public static RevParReportDto RevPar(
        DateOnly from,
        DateOnly to,
        int unitCount,
        IReadOnlyList<(Stay Stay, Folio? Folio)> stays,
        IReadOnlyList<Invoice> invoices)
    {
        var available = unitCount * (to.DayNumber - from.DayNumber + 1);
        var folioRevenue = stays
            .Where(x => x.Stay.Status != StayStatus.Cancelled && x.Folio is not null)
            .Where(x => AnalyticsPeriod.LocalDate(x.Stay.CheckInAt) is var d && d >= from && d <= to)
            .SelectMany(x => x.Folio!.Charges)
            .Where(c => !c.IsVoided && c.ChargeCategoryCode == UtilityChargeCategories.ShortStayRoom)
            .Sum(c => ThaiTaxCalculator.CalculateLine(c.Amount, c.TaxMode).SubTotal);

        var rentRevenue = 0m;
        foreach (var invoice in invoices.Where(i => i.Status is not (InvoiceStatus.Draft or InvoiceStatus.Voided)))
        {
            if (!TryParsePeriod(invoice.BillingPeriodYearMonth, out var periodStart, out var periodEnd))
            {
                continue;
            }

            var overlapStart = Max(periodStart, from);
            var overlapEnd = Min(periodEnd, to);
            var overlapDays = overlapEnd.DayNumber - overlapStart.DayNumber + 1;
            if (overlapDays <= 0)
            {
                continue;
            }

            var daysInMonth = periodEnd.DayNumber - periodStart.DayNumber + 1;
            rentRevenue += invoice.Lines
                .Where(l => l.ChargeCategoryCode == UtilityChargeCategories.MonthlyRoomRent)
                .Sum(l => l.SubTotal * overlapDays / daysInMonth);
        }

        folioRevenue = Money(folioRevenue);
        rentRevenue = Money(rentRevenue);
        var roomRevenue = folioRevenue + rentRevenue;
        return new RevParReportDto(from, to, available, folioRevenue, rentRevenue, roomRevenue, available == 0 ? 0m : Money(roomRevenue / available));
    }

    // Receivables aging as of a date. Invoices have no separate due date, so they are due on issue:
    // age = asOf - issue date (IssuedAt, or CreatedAt for invoices issued before IssuedAt existed).
    // Buckets: Current (age 0), 1-30, 31-60, 61-90, 90+ days. Outstanding = TotalAmount - receipts applied so far;
    // invoices issued after asOf are not yet receivable and are left out.
    public static AgingReportDto Aging(
        DateOnly asOf,
        IReadOnlyList<Invoice> invoices,
        IReadOnlyList<Receipt> receipts,
        IReadOnlyDictionary<Guid, Customer> customers,
        bool unmaskPii)
    {
        var paidByInvoice = receipts.GroupBy(r => r.InvoiceId).ToDictionary(g => g.Key, g => g.Sum(r => r.NetPayableAmount));
        var rows = invoices
            .Where(i => i.Status is InvoiceStatus.Issued or InvoiceStatus.PartiallyPaid or InvoiceStatus.Overdue)
            .Select(i => (
                Invoice: i,
                Outstanding: i.TotalAmount - paidByInvoice.GetValueOrDefault(i.Id),
                Age: asOf.DayNumber - AnalyticsPeriod.LocalDate(i.IssuedAt ?? i.CreatedAt).DayNumber))
            .Where(x => x.Outstanding > 0m && x.Age >= 0)
            .ToList();

        var customerRows = rows
            .GroupBy(x => x.Invoice.CustomerId)
            .Select(g =>
            {
                var customer = customers[g.Key];
                return new AgingCustomerRowDto(
                    new CustomerRefDto(customer.Id, customer.FullName, unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
                    g.Count(),
                    Buckets(g.Select(x => (x.Outstanding, x.Age))));
            })
            .OrderByDescending(r => r.Buckets.Total)
            .ThenBy(r => r.Customer.FullName, StringComparer.Ordinal)
            .ToList();
        return new AgingReportDto(asOf, Buckets(rows.Select(x => (x.Outstanding, x.Age))), customerRows);
    }

    // Shifts opened within the range (Bangkok dates); receipts counted by their issue date.
    public static CashierShiftSummaryDto CashierShiftSummary(
        DateOnly from,
        DateOnly to,
        IReadOnlyList<CashierShift> shifts,
        IReadOnlyList<Receipt> receipts,
        Func<string?, UserRefDto?> users)
    {
        bool InRange(DateTimeOffset at) => AnalyticsPeriod.LocalDate(at) is var d && d >= from && d <= to;
        var inRange = shifts.Where(s => InRange(s.CreatedAt)).ToList();
        var periodReceipts = receipts.Where(r => InRange(r.CreatedAt)).ToList();
        return new CashierShiftSummaryDto(
            from,
            to,
            inRange.Count,
            inRange.Count(s => s.Status == CashierShiftStatus.Open),
            inRange.Count(s => s.Status == CashierShiftStatus.Closed),
            inRange.Count(s => s.Status == CashierShiftStatus.Reconciled),
            inRange.Count(s => s.Status == CashierShiftStatus.Cancelled),
            inRange.Sum(s => s.CashReceiptsInShift),
            inRange.Sum(s => s.CashDepositsReceivedInShift),
            inRange.Sum(s => s.CashDepositsRefundedInShift),
            inRange.Sum(s => s.CashVariance ?? 0m),
            inRange.Count(s => s.CashVariance is { } v && v != 0m),
            periodReceipts.Count,
            periodReceipts.Sum(r => r.NetPayableAmount),
            inRange
                .GroupBy(s => s.CashierUserId)
                .Select(g => new CashierShiftSummaryRowDto(users(g.Key)!, g.Count(), g.Sum(s => s.CashReceiptsInShift), g.Sum(s => s.CashVariance ?? 0m)))
                .OrderBy(r => r.Cashier.Id, StringComparer.Ordinal)
                .ToList());
    }

    // Held balance is the live liability per deposit type; period columns are the ledger movements dated within the range.
    public static DepositSummaryDto DepositSummary(DateOnly from, DateOnly to, IReadOnlyList<DepositLedger> ledgers)
    {
        bool InRange(DateTimeOffset at) => AnalyticsPeriod.LocalDate(at) is var d && d >= from && d <= to;
        var byType = Enum.GetValues<DepositType>()
            .Select(type =>
            {
                var ofType = ledgers.Where(l => l.DepositType == type).ToList();
                var periodTx = ofType.SelectMany(l => l.Transactions).Where(t => InRange(t.CreatedAt)).ToList();
                return new DepositTypeSummaryDto(
                    type.ToString(),
                    ofType.Count,
                    ofType.Sum(l => l.CurrentBalance),
                    periodTx.Where(t => t.TransactionType == DepositTransactionType.Received).Sum(t => t.Amount),
                    periodTx.Where(t => t.TransactionType is DepositTransactionType.DeductedForDamageOrUtility or DepositTransactionType.Forfeited).Sum(t => t.Amount),
                    periodTx.Where(t => t.TransactionType == DepositTransactionType.Refunded).Sum(t => t.Amount));
            })
            .ToList();
        return new DepositSummaryDto(from, to, "Liability", byType.Sum(t => t.HeldBalance), byType);
    }

    private static AgingBucketsDto Buckets(IEnumerable<(decimal Outstanding, int Age)> items)
    {
        var list = items.ToList();
        decimal Sum(Func<int, bool> inBucket) => list.Where(x => inBucket(x.Age)).Sum(x => x.Outstanding);
        return new AgingBucketsDto(
            Sum(a => a == 0),
            Sum(a => a is >= 1 and <= 30),
            Sum(a => a is >= 31 and <= 60),
            Sum(a => a is >= 61 and <= 90),
            Sum(a => a > 90),
            list.Sum(x => x.Outstanding));
    }

    private static bool TryParsePeriod(string? period, out DateOnly start, out DateOnly end)
    {
        start = default;
        end = default;
        return period is not null && Meters.BillingPeriod.Parse(period, out start, out end) is null;
    }

    private static int Priority(StayMode mode) => mode switch
    {
        StayMode.Monthly => 3,
        StayMode.Daily => 2,
        _ => 1
    };

    private static decimal Rate(int occupied, int available) =>
        available == 0 ? 0m : decimal.Round((decimal)occupied / available, 4, MidpointRounding.AwayFromZero);

    private static decimal Money(decimal amount) => decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;

    private static DateOnly Max(DateOnly a, DateOnly b) => a > b ? a : b;
}
