using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Payments;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

// PM-10: client self-service isolation, lease intents and executive analytics against hand-computed seed numbers.
public sealed class ClientSelfServiceAndAnalyticsTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly Guid A201 = PmsSeedConstants.OccupiedMonthlyUnitA201Id;
    private static readonly Guid Primary = PmsSeedConstants.PrimaryCustomerId;
    private static readonly Guid Secondary = PmsSeedConstants.SecondaryCustomerId;

    private static TestCurrentUserContext Admin(params string[] permissions) => new()
    {
        UserId = "pimchanok.bkk",
        IsAdminScope = true,
        HasOpenCashierShift = true,
        AllowedPropertyIds = new HashSet<Guid> { Bkk },
        Permissions = new HashSet<string>(permissions)
    };

    private static TestCurrentUserContext Client(Guid customerId) => new()
    {
        UserId = $"client-{customerId:N}",
        IsClientScope = true,
        CustomerId = customerId
    };

    private static SaveMeterReadingsRequest Readings(string period, decimal water, decimal electric) =>
        new(period, [new MeterReadingInputDto(A201, water, electric)]);

    [Fact]
    public void Client_Leases_Invoices_Usage_And_Slips_Should_Be_Own_Only_And_Hide_Drafts()
    {
        var store = new InMemoryOperationalService();
        var lease = Assert.Single(new GetClientLeasesHandler(store, Client(Primary)).Handle(new GetClientLeasesQuery()).Value!.Items);
        Assert.Equal("A-201", lease.Unit.UnitNumber);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientLeaseHandler(store, Client(Secondary))
            .Handle(new GetClientLeaseQuery(lease.Id)).Error!.Code);

        Assert.True(store.SaveAdminMeterReadings(Bkk, Readings("2026-09", 10m, 100m), false).Value!.IsSaved);
        Assert.True(store.SaveAdminMeterReadings(Bkk, Readings("2026-10", 25m, 180m), false).Value!.IsSaved);
        var draft = Assert.Single(store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Created);

        var invoices = new GetClientInvoicesHandler(store, Client(Primary)).Handle(new GetClientInvoicesQuery(null)).Value!.Items;
        var issued = Assert.Single(invoices); // the seeded Issued 2026-11 invoice; the 2026-10 Draft stays hidden
        Assert.Equal(9570m, issued.OutstandingAmount); // 8,500 exempt + 1,000 + 7% VAT
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientInvoiceHandler(store, Client(Primary))
            .Handle(new GetClientInvoiceQuery(draft.Id)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientInvoiceHandler(store, Client(Secondary))
            .Handle(new GetClientInvoiceQuery(issued.Invoice.Id)).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new GetClientInvoicesHandler(store, Client(Primary))
            .Handle(new GetClientInvoicesQuery("Draft")).Error!.Code);

        var slip = store.SubmitClientPaymentSlip(Primary, issued.Invoice.Id, new SubmitPaymentSlipRequest(570m, "legacy")).Value!;
        Assert.True(store.ApproveAdminPaymentSlip(Bkk, slip.Id, "pimchanok.bkk").IsSuccess);
        var paid = new GetClientInvoiceHandler(store, Client(Primary)).Handle(new GetClientInvoiceQuery(issued.Invoice.Id)).Value!;
        Assert.Equal(570m, paid.PaidAmount);
        Assert.Equal(9000m, paid.OutstandingAmount);
        Assert.Single(paid.Receipts);
        Assert.Equal("Approved", Assert.Single(paid.Slips).Status);
        Assert.Single(new GetClientPaymentSlipsHandler(store, Client(Primary)).Handle(new GetClientPaymentSlipsQuery()).Value!.Items);
        Assert.Empty(new GetClientPaymentSlipsHandler(store, Client(Secondary)).Handle(new GetClientPaymentSlipsQuery()).Value!.Items);

        var usage = new GetClientUtilityUsageHandler(store, Client(Primary)).Handle(new GetClientUtilityUsageQuery(null, 12)).Value!;
        Assert.Equal(["2026-09", "2026-10"], usage.Months.Select(m => m.Period).ToArray());
        Assert.Equal(15m, usage.Months[1].WaterUsageUnits);
        Assert.Equal(80m, usage.Months[1].ElectricUsageUnits);
        Assert.Single(new GetClientUtilityUsageHandler(store, Client(Primary)).Handle(new GetClientUtilityUsageQuery(lease.Id, 1)).Value!.Months);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientUtilityUsageHandler(store, Client(Secondary))
            .Handle(new GetClientUtilityUsageQuery(lease.Id, 12)).Error!.Code);
    }

    [Fact]
    public void Lease_Intent_Lifecycle_Should_Apply_Renew_Or_MoveOut_Notify_And_Enforce_Ownership()
    {
        var store = new InMemoryOperationalService();
        var lease = store.GetClientLeases(Primary).Value!.Items.Single();
        var create = new CreateClientLeaseIntentHandler(store, Client(Primary), store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, create.Handle(new CreateClientLeaseIntentCommand(
            lease.Id, new CreateLeaseIntentRequest("Renew", lease.EndDate))).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new CreateClientLeaseIntentHandler(store, Client(Secondary), store)
            .Handle(new CreateClientLeaseIntentCommand(lease.Id, new CreateLeaseIntentRequest("Renew", new DateOnly(2027, 6, 30)))).Error!.Code);

        var renew = create.Handle(new CreateClientLeaseIntentCommand(lease.Id, new CreateLeaseIntentRequest("Renew", new DateOnly(2027, 6, 30), "One more year"))).Value!;
        Assert.Equal("Pending", renew.Status);
        Assert.Equal(DomainErrorCodes.ValidationFailed, create.Handle(new CreateClientLeaseIntentCommand(
            lease.Id, new CreateLeaseIntentRequest("MoveOut", lease.EndDate))).Error!.Code); // one Pending per lease
        Assert.Equal(DomainErrorCodes.PermissionDenied, new UpdateClientLeaseIntentHandler(store, Client(Secondary), store)
            .Handle(new UpdateClientLeaseIntentCommand(renew.Id, new UpdateLeaseIntentRequest(new DateOnly(2027, 12, 31)))).Error!.Code);
        Assert.Equal(new DateOnly(2027, 12, 31), new UpdateClientLeaseIntentHandler(store, Client(Primary), store)
            .Handle(new UpdateClientLeaseIntentCommand(renew.Id, new UpdateLeaseIntentRequest(new DateOnly(2027, 12, 31)))).Value!.DesiredDate);

        Assert.Equal(DomainErrorCodes.PermissionDenied, new ApproveAdminLeaseIntentHandler(store, Admin(PermissionKeys.AdminBillingIssueBatch), store)
            .Handle(new ApproveAdminLeaseIntentCommand(Bkk, renew.Id)).Error!.Code);
        var leaseAdmin = Admin(PermissionKeys.AdminLeasesManage);
        var approved = new ApproveAdminLeaseIntentHandler(store, leaseAdmin, store).Handle(new ApproveAdminLeaseIntentCommand(Bkk, renew.Id)).Value!;
        Assert.Equal("Approved", approved.Status);
        Assert.Equal("Pimchanok Srisawat", approved.ReviewedBy!.FullName);
        Assert.Equal(new DateOnly(2027, 12, 31), store.GetClientLease(Primary, lease.Id).Value!.EndDate);
        Assert.Contains(store.GetClientNotifications(Primary).Value!.Items, n => n.TemplateKey == LeaseIntentRules.ApprovedTemplateKey);

        var moveOut = create.Handle(new CreateClientLeaseIntentCommand(lease.Id, new CreateLeaseIntentRequest("MoveOut", new DateOnly(2027, 12, 31)))).Value!;
        Assert.Equal("Withdrawn", new WithdrawClientLeaseIntentHandler(store, Client(Primary), store)
            .Handle(new WithdrawClientLeaseIntentCommand(moveOut.Id)).Value!.Status);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.ApproveAdminLeaseIntent(Bkk, moveOut.Id, "x").Error!.Code);

        var second = create.Handle(new CreateClientLeaseIntentCommand(lease.Id, new CreateLeaseIntentRequest("MoveOut", new DateOnly(2027, 12, 31)))).Value!;
        var reject = new RejectAdminLeaseIntentHandler(store, leaseAdmin, store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, reject.Handle(new RejectAdminLeaseIntentCommand(Bkk, second.Id, new ReasonRequest(" "))).Error!.Code);
        Assert.Equal("Rejected", reject.Handle(new RejectAdminLeaseIntentCommand(Bkk, second.Id, new ReasonRequest("Notice period is 30 days"))).Value!.Status);
        Assert.Contains(store.GetClientNotifications(Primary).Value!.Items, n => n.TemplateKey == LeaseIntentRules.RejectedTemplateKey);

        var third = create.Handle(new CreateClientLeaseIntentCommand(lease.Id, new CreateLeaseIntentRequest("MoveOut", new DateOnly(2027, 12, 31)))).Value!;
        Assert.True(store.ApproveAdminLeaseIntent(Bkk, third.Id, "pimchanok.bkk").IsSuccess);
        Assert.Equal("MoveOutNotice", store.GetClientLease(Primary, lease.Id).Value!.Status);
        Assert.Equal(4, new GetAdminLeaseIntentsHandler(store, leaseAdmin).Handle(new GetAdminLeaseIntentsQuery(Bkk, null)).Value!.Items.Count);
        Assert.Equal(4, new GetClientLeaseIntentsHandler(store, Client(Primary)).Handle(new GetClientLeaseIntentsQuery()).Value!.Items.Count);
        Assert.Empty(store.GetClientLeaseIntents(Secondary).Value!.Items);
    }

    [Fact]
    public void Client_Can_View_And_Cancel_Only_Own_Hold()
    {
        var store = new InMemoryOperationalService();
        var holdId = PmsSeedConstants.SampleHoldReservationId;
        Assert.Equal("Hold", new GetClientReservationHandler(store, Client(Primary)).Handle(new GetClientReservationQuery(holdId)).Value!.Status);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientReservationHandler(store, Client(Secondary))
            .Handle(new GetClientReservationQuery(holdId)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new CancelClientReservationHandler(store, Client(Secondary), store)
            .Handle(new CancelClientReservationCommand(holdId, new ReasonRequest("x"))).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new CancelClientReservationHandler(store, Client(Secondary), store)
            .Handle(new CancelClientReservationCommand(PmsSeedConstants.SampleConfirmedReservationId, new ReasonRequest("x"))).Error!.Code);
        var cancelled = new CancelClientReservationHandler(store, Client(Primary), store)
            .Handle(new CancelClientReservationCommand(holdId, new ReasonRequest("Changed plans")));
        Assert.Equal("Cancelled", cancelled.Value!.Status);
    }

    [Fact]
    public void Occupancy_And_RevPar_Should_Match_Hand_Computed_Seed_Numbers()
    {
        var store = new InMemoryOperationalService();
        var analyst = Admin(PermissionKeys.AdminAnalyticsRead);
        var from = new DateOnly(2026, 10, 1);
        var to = new DateOnly(2026, 10, 31);

        // 3 units x 31 nights = 93; A-201 lease = 31 Monthly nights; seeded A-102 Daily stay 20-22 Oct (Bangkok) = 2 nights.
        var occupancy = new GetAdminOccupancyReportHandler(store, analyst).Handle(new GetAdminOccupancyReportQuery(Bkk, from, to)).Value!;
        Assert.Equal(93, occupancy.AvailableUnitNights);
        Assert.Equal(33, occupancy.OccupiedUnitNights);
        Assert.Equal(0.3548m, occupancy.OccupancyRate);
        Assert.Equal(31, occupancy.ByStayMode.Single(m => m.StayMode == "Monthly").OccupiedUnitNights);
        Assert.Equal(2, occupancy.ByStayMode.Single(m => m.StayMode == "Daily").OccupiedUnitNights);
        Assert.Equal(0, occupancy.ByStayMode.Single(m => m.StayMode == "Hourly").OccupiedUnitNights);
        Assert.Equal(33, Assert.Single(occupancy.ByBuilding).OccupiedUnitNights);

        // Folio room charge 2,400 VAT-included -> 2,242.99 ex-VAT; no October rent invoice yet. 2,242.99 / 93 = 24.12.
        var revpar = new GetAdminRevParReportHandler(store, analyst).Handle(new GetAdminRevParReportQuery(Bkk, from, to)).Value!;
        Assert.Equal(2242.99m, revpar.FolioRoomRevenue);
        Assert.Equal(0m, revpar.LeaseRentRevenue);
        Assert.Equal(24.12m, revpar.RevPar);

        // Issue the October rent (8,500 exempt) -> (2,242.99 + 8,500) / 93 = 115.52. Drafts never count.
        Assert.True(store.SaveAdminMeterReadings(Bkk, Readings("2026-10", 10m, 100m), false).Value!.IsSaved);
        var draft = Assert.Single(store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Created);
        Assert.Equal(0m, store.GetRevParReport(Bkk, from, to).Value!.LeaseRentRevenue);
        Assert.True(store.IssueAdminInvoice(Bkk, draft.Id).IsSuccess);
        var withRent = store.GetRevParReport(Bkk, from, to).Value!;
        Assert.Equal(8500m, withRent.LeaseRentRevenue);
        Assert.Equal(115.52m, withRent.RevPar);
        // Half of October -> half the rent accrues: 8,500 x 15 / 31 = 4,112.90.
        Assert.Equal(4112.90m, store.GetRevParReport(Bkk, from, new DateOnly(2026, 10, 15)).Value!.LeaseRentRevenue);

        var cnxOnly = new TestCurrentUserContext
        {
            UserId = "cnx",
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.CnxPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminAnalyticsRead }
        };
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminOccupancyReportHandler(store, cnxOnly)
            .Handle(new GetAdminOccupancyReportQuery(Bkk, from, to)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetAdminRevParReportHandler(store, Admin(PermissionKeys.AdminLeasesManage))
            .Handle(new GetAdminRevParReportQuery(Bkk, from, to)).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new GetAdminRevParReportHandler(store, analyst)
            .Handle(new GetAdminRevParReportQuery(Bkk, to, from)).Error!.Code);
    }

    [Fact]
    public void Aging_Cashier_And_Deposit_Reports_Should_Bucket_And_Total_Correctly()
    {
        var store = new InMemoryOperationalService();
        var analyst = Admin(PermissionKeys.AdminAnalyticsRead);
        var today = AnalyticsPeriod.Today();

        // Seeded invoices were issued today: 9,570 (customer 1) and 1,200 (customer 2). 45 days later both sit in 31-60.
        var aging = new GetAdminAgingReportHandler(store, analyst).Handle(new GetAdminAgingReportQuery(Bkk, null, today.AddDays(45))).Value!;
        Assert.Equal(10770m, aging.Totals.Days31To60);
        Assert.Equal(10770m, aging.Totals.Total);
        Assert.Equal(9570m, aging.Customers[0].Buckets.Total);
        Assert.Equal("1-xxxx-xxxxx-12-3", aging.Customers[0].Customer.MaskedNationalId);
        Assert.Equal(10770m, store.GetAgingReport(Bkk, today).Value!.Totals.Current);
        Assert.Equal(0m, store.GetAgingReport(Bkk, today.AddDays(-1)).Value!.Totals.Total); // not yet issued then

        var cashier = Admin(PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut, PermissionKeys.AdminCashierOperateShift, PermissionKeys.AdminLeasesManage);
        var shift = store.OpenAdminCashierShift(Bkk, cashier.UserId, new OpenCashierShiftRequest(1000m)).Value!;
        var stay = new CheckInStayHandler(store, cashier).Handle(new CheckInStayCommand(
            Bkk, PmsSeedConstants.CleanUnitA101Id, Primary, "Hourly", 300m)).Value!;
        var balance = store.GetAdminStays(Bkk, "Active", null).Value!.Items.Single(s => s.Id == stay.Id).Folio.BalanceDue;
        Assert.True(new RecordAdminFolioPaymentHandler(store, cashier, store)
            .Handle(new RecordAdminFolioPaymentCommand(Bkk, stay.Id, new RecordFolioPaymentRequest(balance, "Cash"))).IsSuccess);
        Assert.True(new CreateAdminLeaseHandler(store, cashier, store).Handle(new CreateAdminLeaseCommand(Bkk, new CreateLeaseRequest(
            PmsSeedConstants.DirtyUnitA102Id, Secondary, new DateOnly(2027, 1, 1), new DateOnly(2027, 12, 31), 6000m, 12000m, 0m, 0m))).IsSuccess);
        var closed = store.CloseAdminCashierShift(Bkk, shift.Id, cashier.UserId, new CloseCashierShiftRequest(1000m + balance + 300m + 12000m - 10m, "Short 10")).Value!;
        Assert.Equal(-10m, closed.CashVariance);

        var shifts = new GetAdminCashierShiftSummaryReportHandler(store, analyst).Handle(new GetAdminCashierShiftSummaryReportQuery(Bkk, null, null)).Value!;
        Assert.Equal(1, shifts.ShiftCount);
        Assert.Equal(1, shifts.ClosedCount);
        Assert.Equal(balance, shifts.CashReceiptsTotal);
        Assert.Equal(12300m, shifts.DepositsReceivedTotal);
        Assert.Equal(-10m, shifts.VarianceTotal);
        Assert.Equal(1, shifts.ShiftsWithVariance);
        Assert.Equal("Pimchanok Srisawat", Assert.Single(shifts.Cashiers).Cashier.FullName);

        var deposits = new GetAdminDepositSummaryReportHandler(store, analyst).Handle(new GetAdminDepositSummaryReportQuery(Bkk, null, null)).Value!;
        Assert.Equal("Liability", deposits.Classification);
        Assert.Equal(12300m, deposits.TotalHeldBalance);
        Assert.Equal(300m, deposits.ByType.Single(t => t.DepositType == "KeyDeposit").HeldBalance);
        Assert.Equal(12000m, deposits.ByType.Single(t => t.DepositType == "LeaseSecurityDeposit").ReceivedInPeriod);
    }

    private sealed class TestCurrentUserContext : ICurrentUserContext
    {
        public string UserId { get; set; } = "test-user";
        public bool IsAdminScope { get; set; }
        public bool IsClientScope { get; set; }
        public IReadOnlySet<Guid> AllowedPropertyIds { get; set; } = new HashSet<Guid>();
        public IReadOnlySet<string> Permissions { get; set; } = new HashSet<string>();
        public Guid? CustomerId { get; set; }
        public bool HasOpenCashierShift { get; set; }
    }
}
