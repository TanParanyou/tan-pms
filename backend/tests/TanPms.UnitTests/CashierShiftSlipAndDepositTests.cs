using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Leases;
using TanPms.Application.Payments;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class CashierShiftSlipAndDepositTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;

    private static TestCurrentUserContext Admin(string userId, params string[] permissions) => new()
    {
        UserId = userId,
        IsAdminScope = true,
        AllowedPropertyIds = new HashSet<Guid> { Bkk },
        Permissions = new HashSet<string>(permissions)
    };

    private static TestCurrentUserContext Client(Guid customerId) => new()
    {
        UserId = $"client-{customerId:N}",
        IsClientScope = true,
        CustomerId = customerId
    };

    private static InvoiceItemDto SeedInvoice(InMemoryOperationalService store, string documentNumber) =>
        store.GetAdminInvoices(Bkk, null, null).Value!.Items.Single(i => i.DocumentNumber == documentNumber);

    [Fact]
    public void Shift_Open_Close_Reconcile_Should_Enforce_Single_Open_Variance_Remark_Owner_And_Permission()
    {
        var store = new InMemoryOperationalService();
        var cashier = Admin("cashier-01", PermissionKeys.AdminCashierOperateShift);

        var opened = new OpenAdminCashierShiftHandler(store, cashier, store)
            .Handle(new OpenAdminCashierShiftCommand(Bkk, new OpenCashierShiftRequest(1000m)));
        Assert.True(opened.IsSuccess, opened.Error?.Message);
        Assert.StartsWith("BKK01-SHF-", opened.Value!.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("Open", opened.Value.Status);
        Assert.True(store.HasOpenCashierShift("cashier-01", new HashSet<Guid> { Bkk }));
        Assert.False(store.HasOpenCashierShift("someone-else", new HashSet<Guid> { Bkk }));

        var doubleOpen = new OpenAdminCashierShiftHandler(store, cashier, store)
            .Handle(new OpenAdminCashierShiftCommand(Bkk, new OpenCashierShiftRequest(500m)));
        Assert.Equal(DomainErrorCodes.ValidationFailed, doubleOpen.Error!.Code);

        var current = new GetCurrentAdminCashierShiftHandler(store, cashier).Handle(new GetCurrentAdminCashierShiftQuery(Bkk));
        Assert.Equal(opened.Value.Id, current.Value!.Shift!.Id);

        var notOwner = new CloseAdminCashierShiftHandler(store, Admin("cashier-02", PermissionKeys.AdminCashierOperateShift), store)
            .Handle(new CloseAdminCashierShiftCommand(Bkk, opened.Value.Id, new CloseCashierShiftRequest(1000m)));
        Assert.Equal(DomainErrorCodes.PermissionDenied, notOwner.Error!.Code);

        var earlyReconcile = new ReconcileAdminCashierShiftHandler(store, Admin("supervisor", PermissionKeys.AdminCashierReconcileShift), store)
            .Handle(new ReconcileAdminCashierShiftCommand(Bkk, opened.Value.Id, new ReconcileCashierShiftRequest()));
        Assert.Equal(DomainErrorCodes.ValidationFailed, earlyReconcile.Error!.Code);

        var closer = new CloseAdminCashierShiftHandler(store, cashier, store);
        var noRemark = closer.Handle(new CloseAdminCashierShiftCommand(Bkk, opened.Value.Id, new CloseCashierShiftRequest(1100m)));
        Assert.Equal(DomainErrorCodes.ValidationFailed, noRemark.Error!.Code);

        var closed = closer.Handle(new CloseAdminCashierShiftCommand(Bkk, opened.Value.Id, new CloseCashierShiftRequest(1100m, "Found extra change")));
        Assert.True(closed.IsSuccess, closed.Error?.Message);
        Assert.Equal("Closed", closed.Value!.Status);
        Assert.Equal(1000m, closed.Value.ExpectedDrawerCash);
        Assert.Equal(100m, closed.Value.CashVariance);
        Assert.Null(store.GetCurrentAdminCashierShift(Bkk, "cashier-01").Value!.Shift);

        var deniedReconcile = new ReconcileAdminCashierShiftHandler(store, cashier, store)
            .Handle(new ReconcileAdminCashierShiftCommand(Bkk, opened.Value.Id, new ReconcileCashierShiftRequest()));
        Assert.Equal(DomainErrorCodes.PermissionDenied, deniedReconcile.Error!.Code);

        var reconciled = new ReconcileAdminCashierShiftHandler(store, Admin("supervisor", PermissionKeys.AdminCashierReconcileShift), store)
            .Handle(new ReconcileAdminCashierShiftCommand(Bkk, opened.Value.Id, new ReconcileCashierShiftRequest("Variance verified")));
        Assert.Equal("Reconciled", reconciled.Value!.Status);
        Assert.Contains(store.AuditEvents, e =>
            e.ActionKey == PermissionKeys.AdminCashierReconcileShift && e.EntityId == opened.Value.Id && e.Reason == "Variance verified");

        Assert.Single(store.GetAdminCashierShifts(Bkk, "Reconciled").Value!.Items);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.GetAdminCashierShifts(Bkk, "Bogus").Error!.Code);
    }

    [Fact]
    public void Slip_Approval_Should_Create_Receipt_Apply_Partial_Then_Full_Payment_And_Reject_Double_Approval()
    {
        var store = new InMemoryOperationalService();
        var invoice = SeedInvoice(store, "BKK01-INV-2611-0002"); // customer2, Issued, 1,200.00
        var slipKey = TestFiles.Client(store, StoredFilePurpose.PaymentSlip, PmsSeedConstants.SecondaryCustomerId);
        var customer2 = Client(PmsSeedConstants.SecondaryCustomerId);
        var verifier = Admin("verifier", PermissionKeys.AdminPaymentsVerifySlip);

        var otherCustomer = new SubmitClientPaymentSlipHandler(store, Client(PmsSeedConstants.PrimaryCustomerId), store, store)
            .Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(100m, TestFiles.Client(store, StoredFilePurpose.PaymentSlip, PmsSeedConstants.PrimaryCustomerId))));
        Assert.Equal(DomainErrorCodes.PermissionDenied, otherCustomer.Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientInvoiceSlipsHandler(store, Client(PmsSeedConstants.PrimaryCustomerId))
            .Handle(new GetClientInvoiceSlipsQuery(invoice.Id)).Error!.Code);

        var submitter = new SubmitClientPaymentSlipHandler(store, customer2, store, store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, submitter
            .Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(1200.01m, slipKey))).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, submitter
            .Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(0m, slipKey))).Error!.Code);

        var partial = submitter.Handle(new SubmitClientPaymentSlipCommand(
            invoice.Id,
            new SubmitPaymentSlipRequest(500m, slipKey, "KBANK-123", new DateTimeOffset(2026, 11, 8, 9, 0, 0, TimeSpan.Zero))));
        Assert.Equal("Pending", partial.Value!.Status);

        var queue = new GetAdminPaymentSlipsHandler(store, verifier).Handle(new GetAdminPaymentSlipsQuery(Bkk, "Pending"));
        var queued = Assert.Single(queue.Value!.Items);
        Assert.Equal("BKK01-INV-2611-0002", queued.InvoiceDocumentNumber);
        Assert.Equal("3-xxxx-xxxxx-54-1", queued.Customer.MaskedNationalId);
        Assert.Equal(1200m, queued.InvoiceOutstandingAmount);

        var approver = new ApproveAdminPaymentSlipHandler(store, verifier, store);
        var approved = approver.Handle(new ApproveAdminPaymentSlipCommand(Bkk, partial.Value.Id));
        Assert.True(approved.IsSuccess, approved.Error?.Message);
        Assert.Equal("Approved", approved.Value!.Status);
        Assert.StartsWith("BKK01-RCT-", approved.Value.ReceiptDocumentNumber, StringComparison.Ordinal);
        Assert.Equal("PartiallyPaid", approved.Value.InvoiceStatus);
        Assert.Equal(700m, approved.Value.InvoiceOutstandingAmount);
        Assert.Equal("verifier", approved.Value.ReviewedByUserId);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminPaymentsVerifySlip && e.EntityId == partial.Value.Id);

        var doubleApprove = approver.Handle(new ApproveAdminPaymentSlipCommand(Bkk, partial.Value.Id));
        Assert.Equal(DomainErrorCodes.ValidationFailed, doubleApprove.Error!.Code);
        Assert.Empty(store.GetAdminPaymentSlips(Bkk, "Pending").Value!.Items);

        var rest = submitter.Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(700m, slipKey)));
        var paid = approver.Handle(new ApproveAdminPaymentSlipCommand(Bkk, rest.Value!.Id));
        Assert.Equal("Paid", paid.Value!.InvoiceStatus);
        Assert.Equal(0m, paid.Value.InvoiceOutstandingAmount);

        var afterPaid = submitter.Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(1m, slipKey)));
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, afterPaid.Error!.Code);
    }

    [Fact]
    public void Slip_Reject_Should_Require_Reason_And_Be_Visible_To_Client_And_Scope_Denied_Elsewhere()
    {
        var store = new InMemoryOperationalService();
        var invoice = SeedInvoice(store, "BKK01-INV-2611-0001"); // customer1, Issued
        var slip = new SubmitClientPaymentSlipHandler(store, Client(PmsSeedConstants.PrimaryCustomerId), store, store)
            .Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(100m, TestFiles.Client(store, StoredFilePurpose.PaymentSlip, PmsSeedConstants.PrimaryCustomerId)))).Value!;

        var rejecter = new RejectAdminPaymentSlipHandler(store, Admin("verifier", PermissionKeys.AdminPaymentsVerifySlip), store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, rejecter
            .Handle(new RejectAdminPaymentSlipCommand(Bkk, slip.Id, new RejectPaymentSlipRequest(" "))).Error!.Code);

        var rejected = rejecter.Handle(new RejectAdminPaymentSlipCommand(Bkk, slip.Id, new RejectPaymentSlipRequest("Amount does not match transfer")));
        Assert.Equal("Rejected", rejected.Value!.Status);
        Assert.Equal("Issued", rejected.Value.InvoiceStatus);

        var clientView = new GetClientInvoiceSlipsHandler(store, Client(PmsSeedConstants.PrimaryCustomerId))
            .Handle(new GetClientInvoiceSlipsQuery(invoice.Id));
        Assert.Equal("Amount does not match transfer", Assert.Single(clientView.Value!.Items).RejectReason);

        var otherProperty = new TestCurrentUserContext
        {
            UserId = "cnx-verifier",
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.CnxPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminPaymentsVerifySlip, PermissionKeys.AdminCashierOperateShift }
        };
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminPaymentSlipsHandler(store, otherProperty)
            .Handle(new GetAdminPaymentSlipsQuery(Bkk, null)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminDepositLedgersHandler(store, otherProperty)
            .Handle(new GetAdminDepositLedgersQuery(Bkk, null)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new OpenAdminCashierShiftHandler(store, otherProperty, store)
            .Handle(new OpenAdminCashierShiftCommand(Bkk, new OpenCashierShiftRequest(0m))).Error!.Code);
    }

    [Fact]
    public void Deposit_Register_Should_List_Ledgers_By_Type_With_Owner_Unit_Masked_Customer_And_Balances()
    {
        var store = new InMemoryOperationalService();
        var lease = store.CreateAdminLease(Bkk, new CreateLeaseRequest(
            PmsSeedConstants.DirtyUnitA102Id,
            PmsSeedConstants.SecondaryCustomerId,
            new DateOnly(2026, 12, 1),
            new DateOnly(2027, 11, 30),
            6500m,
            13000m,
            0m,
            0m)).Value!;
        Assert.True(store.CheckInStay(
            new CheckInStayCommand(Bkk, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 500m),
            callerHasOverridePermission: false).IsSuccess);

        var handler = new GetAdminDepositLedgersHandler(store, Admin("cashier", PermissionKeys.AdminCashierOperateShift));
        var all = handler.Handle(new GetAdminDepositLedgersQuery(Bkk, null)).Value!;
        Assert.Equal(2, all.Items.Count);
        Assert.Equal(13500m, all.TotalHeldBalance);

        var leaseLedger = Assert.Single(handler.Handle(new GetAdminDepositLedgersQuery(Bkk, "LeaseSecurityDeposit")).Value!.Items);
        Assert.Equal(lease.DocumentNumber, leaseLedger.OwnerDocumentNumber);
        Assert.Equal("A-102", leaseLedger.Unit!.UnitNumber);
        Assert.Equal("3-xxxx-xxxxx-54-1", leaseLedger.Customer.MaskedNationalId);
        Assert.Equal(13000m, leaseLedger.CurrentBalance);
        Assert.StartsWith("BKK01-DEP-", Assert.Single(leaseLedger.Transactions).DocumentNumber, StringComparison.Ordinal);

        var keyLedger = Assert.Single(handler.Handle(new GetAdminDepositLedgersQuery(Bkk, "KeyDeposit")).Value!.Items);
        Assert.StartsWith("BKK01-STY-", keyLedger.OwnerDocumentNumber, StringComparison.Ordinal);
        Assert.Equal(500m, keyLedger.CurrentBalance);

        Assert.Equal(DomainErrorCodes.ValidationFailed, handler.Handle(new GetAdminDepositLedgersQuery(Bkk, "Cash")).Error!.Code);
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
