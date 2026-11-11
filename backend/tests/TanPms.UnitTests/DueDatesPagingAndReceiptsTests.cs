using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Stays;
using TanPms.Application.WorkOrders;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Pdf;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

// Round B4: due dates + Overdue sweep, server-side paging, deposit payment methods, folio receipts and logout.
public sealed class DueDatesPagingAndReceiptsTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;

    private static TestCurrentUserContext Admin(params string[] permissions) => new()
    {
        UserId = "pimchanok.bkk",
        IsAdminScope = true,
        HasOpenCashierShift = true,
        AllowedPropertyIds = new HashSet<Guid> { Bkk },
        Permissions = new HashSet<string>(permissions)
    };

    [Fact]
    public void Issue_Should_Set_DueDate_From_Payment_Terms_And_Sweep_Overdue_Once()
    {
        var store = new InMemoryOperationalService();
        var today = AnalyticsPeriod.Today();
        var seeded = store.GetAdminInvoices(Bkk, null, null).Value!.Items;
        Assert.All(seeded, i => Assert.Equal(today.AddDays(7), i.DueDate));

        var manager = Admin(PermissionKeys.AdminPropertiesManage);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new UpdateAdminBillingSettingsHandler(store, manager, store)
            .Handle(new UpdateAdminBillingSettingsCommand(Bkk, new UpdateBillingSettingsRequest(-1))).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new UpdateAdminBillingSettingsHandler(store, Admin(PermissionKeys.AdminBillingIssueBatch), store)
            .Handle(new UpdateAdminBillingSettingsCommand(Bkk, new UpdateBillingSettingsRequest(15))).Error!.Code);
        Assert.Equal(15, new UpdateAdminBillingSettingsHandler(store, manager, store)
            .Handle(new UpdateAdminBillingSettingsCommand(Bkk, new UpdateBillingSettingsRequest(15))).Value!.EffectivePaymentTermsDays);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminPropertiesManage && e.Reason == "Payment terms set to 15 days");

        Assert.True(store.SaveAdminMeterReadings(Bkk, new SaveMeterReadingsRequest("2026-10",
            [new MeterReadingInputDto(PmsSeedConstants.OccupiedMonthlyUnitA201Id, 10m, 100m)]), false).Value!.IsSaved);
        var draft = Assert.Single(store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Created);
        Assert.Equal(today.AddDays(15), store.IssueAdminInvoice(Bkk, draft.Id).Value!.DueDate);

        // Ten days later only the two seeded invoices (due +7) are past due; each client is told exactly once.
        var later = DateTimeOffset.UtcNow.AddDays(10);
        Assert.Equal(2, store.MarkOverdueInvoices(later));
        Assert.Equal(0, store.MarkOverdueInvoices(later));
        Assert.Equal("Overdue", store.GetAdminInvoice(Bkk, seeded[0].Id).Value!.Status);
        Assert.Equal("Issued", store.GetAdminInvoice(Bkk, draft.Id).Value!.Status);
        Assert.Single(store.GetClientNotifications(PmsSeedConstants.PrimaryCustomerId).Value!.Items, n => n.TemplateKey == InvoiceOverdueNotification.TemplateKey);

        // Aging uses days past due: as of today+10 the seeded invoices are 3 days late, the October one is not yet due.
        var aging = store.GetAgingReport(Bkk, today.AddDays(10)).Value!;
        Assert.Equal(9570m + 1200m, aging.Totals.Days1To30);
        Assert.Equal(draft.TotalAmount, aging.Totals.Current);
    }

    [Fact]
    public void Paging_Should_Be_Optional_Capped_And_Stable()
    {
        var store = new InMemoryOperationalService();
        for (var i = 0; i < 5; i++)
        {
            Assert.True(store.CreateAdminWorkOrder(Bkk, new CreateWorkOrderRequest(PmsSeedConstants.CleanUnitA101Id, $"Issue {i}")).IsSuccess);
        }

        var ops = Admin(PermissionKeys.AdminWorkOrdersManage);
        var all = new GetAdminWorkOrdersHandler(store, ops).Handle(new GetAdminWorkOrdersQuery(Bkk, null)).Value!;
        Assert.Null(all.Pagination);
        Assert.Equal(5, all.Items.Count);

        var first = new GetAdminWorkOrdersHandler(store, ops).Handle(new GetAdminWorkOrdersQuery(Bkk, null, 1, 2)).Value!;
        var second = new GetAdminWorkOrdersHandler(store, ops).Handle(new GetAdminWorkOrdersQuery(Bkk, null, 2, 2)).Value!;
        var third = new GetAdminWorkOrdersHandler(store, ops).Handle(new GetAdminWorkOrdersQuery(Bkk, null, 3, 2)).Value!;
        Assert.Equal((1, 2, 5, 3), (first.Pagination!.Page, first.Pagination.PageSize, first.Pagination.TotalCount, first.Pagination.TotalPages));
        Assert.Equal(all.Items.Select(w => w.Id), first.Items.Concat(second.Items).Concat(third.Items).Select(w => w.Id));
        Assert.Empty(new GetAdminWorkOrdersHandler(store, ops).Handle(new GetAdminWorkOrdersQuery(Bkk, null, 9, 2)).Value!.Items);
        Assert.Equal(200, new GetAdminWorkOrdersHandler(store, ops).Handle(new GetAdminWorkOrdersQuery(Bkk, null, null, 500)).Value!.Pagination!.PageSize);
        Assert.Single(store.GetClientNotifications(PmsSeedConstants.PrimaryCustomerId, new Application.Common.Models.PageRequest(1, 1)).Value!.Items);
    }

    [Fact]
    public void Only_Cash_Deposit_Movements_Should_Touch_The_Shift_And_Method_Is_Recorded()
    {
        var store = new InMemoryOperationalService();
        var cashier = Admin(PermissionKeys.AdminLeasesManage, PermissionKeys.AdminLeasesSettleMoveOut, PermissionKeys.AdminCashierOperateShift);
        var shift = store.OpenAdminCashierShift(Bkk, cashier.UserId, new OpenCashierShiftRequest(0m)).Value!;
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.CreateAdminLease(Bkk, new CreateLeaseRequest(
            PmsSeedConstants.DirtyUnitA102Id, PmsSeedConstants.SecondaryCustomerId, new DateOnly(2027, 1, 1), new DateOnly(2027, 12, 31), 6000m, 9000m, 0m, 0m,
            PaymentMethod: "Cheque")).Error!.Code);
        var lease = new CreateAdminLeaseHandler(store, cashier, store).Handle(new CreateAdminLeaseCommand(Bkk, new CreateLeaseRequest(
            PmsSeedConstants.DirtyUnitA102Id, PmsSeedConstants.SecondaryCustomerId, new DateOnly(2027, 1, 1), new DateOnly(2027, 12, 31), 6000m, 9000m, 0m, 0m,
            PaymentMethod: "BankTransfer"))).Value!;
        Assert.Equal(0m, store.GetAdminCashierShift(Bkk, shift.Id).Value!.CashDepositsReceivedInShift);

        var cancelled = new CancelAdminLeaseHandler(store, cashier, store)
            .Handle(new CancelAdminLeaseCommand(Bkk, lease.Id, new CancelLeaseRequest("Tenant withdrew", "Cash"))).Value!;
        Assert.Equal(9000m, cancelled.RefundedAmount);
        Assert.Equal(9000m, store.GetAdminCashierShift(Bkk, shift.Id).Value!.CashDepositsRefundedInShift);
        var ledger = store.GetAdminDepositLedgers(Bkk, "LeaseSecurityDeposit").Value!.Items.Single(l => l.OwnerDocumentNumber == lease.DocumentNumber);
        Assert.Equal(new[] { "BankTransfer", "Cash" }, ledger.Transactions.Select(t => t.PaymentMethod ?? "-").ToArray());
    }

    [Fact]
    public void Folio_Payment_Should_Issue_A_Stay_Receipt_With_Pdf_For_Admin_And_Client()
    {
        var store = new InMemoryOperationalService();
        var desk = Admin(PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut, PermissionKeys.AdminPaymentsVerifySlip);
        var stay = new CheckInStayHandler(store, desk, store).Handle(new CheckInStayCommand(
            Bkk, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 0m)).Value!;
        var balance = store.GetAdminStay(Bkk, stay.Id).Value!.Folio.BalanceDue;
        Assert.True(new RecordAdminFolioPaymentHandler(store, desk, store)
            .Handle(new RecordAdminFolioPaymentCommand(Bkk, stay.Id, new RecordFolioPaymentRequest(balance, "PromptPay"))).IsSuccess);

        var receipt = store.GetAdminReceipts(Bkk, null).Value!.Items.Single(r => r.StayId == stay.Id);
        Assert.Null(receipt.InvoiceId);
        Assert.Equal(stay.DocumentNumber, receipt.StayDocumentNumber);
        Assert.Equal("PromptPay", receipt.PaymentMethod);
        Assert.Equal(balance, receipt.NetPayableAmount);
        Assert.False(receipt.IsCashPayment);
        Assert.Contains(store.GetClientReceipts(PmsSeedConstants.PrimaryCustomerId).Value!.Items, r => r.Id == receipt.Id);

        var pdf = new GetAdminReceiptPdfHandler(store, new QuestPdfDocumentRenderer(), desk).Handle(new GetAdminReceiptPdfQuery(Bkk, receipt.Id));
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf.Value!.Content[..4]));
    }

    [Fact]
    public void Logout_Should_Audit_Authenticated_Callers_And_Reject_Anonymous()
    {
        var store = new InMemoryOperationalService();
        Assert.Equal("pimchanok.bkk", new LogoutAuthSessionHandler(Admin(), store, store, TimeProvider.System).Handle(new LogoutAuthSessionCommand()).Value);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == LogoutAuthSessionHandler.ActionKey);
        Assert.Equal(DomainErrorCodes.Unauthenticated, new LogoutAuthSessionHandler(new TestCurrentUserContext { UserId = "" }, store, store, TimeProvider.System)
            .Handle(new LogoutAuthSessionCommand()).Error!.Code);
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
