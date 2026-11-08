using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Files;
using TanPms.Application.Leases;
using TanPms.Application.Payments;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Pdf;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class FilesPdfAndCashBindingTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];

    private static TestCurrentUserContext Admin(string userId, params string[] permissions) => new()
    {
        UserId = userId,
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

    private static LocalDiskFileStorage TempStorage() =>
        new(Path.Combine(Path.GetTempPath(), "tan-pms-tests", Guid.NewGuid().ToString("N")));

    [Fact]
    public void Upload_Should_Validate_Magic_Bytes_Size_Purpose_And_Authorize_Download()
    {
        var store = new InMemoryOperationalService();
        var storage = TempStorage();
        var meterAdmin = Admin("meter-admin", PermissionKeys.AdminMetersRecord);
        var upload = new UploadAdminFileHandler(store, storage, meterAdmin, store);

        var uploaded = upload.Handle(new UploadAdminFileCommand(Bkk, "MeterPhoto", new MemoryStream(Png)));
        Assert.True(uploaded.IsSuccess, uploaded.Error?.Message);
        Assert.Equal("image/png", uploaded.Value!.ContentType);
        Assert.True(StoredFileRules.IsValidFileKey(uploaded.Value.FileKey));
        Assert.Equal(DomainErrorCodes.ValidationFailed, upload.Handle(new UploadAdminFileCommand(Bkk, "MeterPhoto", new MemoryStream("hello"u8.ToArray()))).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, upload.Handle(new UploadAdminFileCommand(
            Bkk, "MeterPhoto", new MemoryStream(new byte[StoredFileRules.MaxSizeBytes + 1]))).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, upload.Handle(new UploadAdminFileCommand(Bkk, "ParcelPhoto", new MemoryStream(Png))).Error!.Code);
        Assert.Equal("application/pdf", StoredFileRules.DetectContentType("%PDF-1.7"u8));
        Assert.False(StoredFileRules.IsValidFileKey("../../etc/passwd"));

        var client = Client(PmsSeedConstants.PrimaryCustomerId);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new UploadClientFileHandler(store, storage, client, store)
            .Handle(new UploadClientFileCommand("IdentityDocument", new MemoryStream(Png))).Error!.Code);
        var clientFile = new UploadClientFileHandler(store, storage, client, store)
            .Handle(new UploadClientFileCommand("PaymentSlip", new MemoryStream(Png))).Value!;

        Assert.True(new GetAdminFileHandler(store, storage, meterAdmin).Handle(new GetAdminFileQuery(uploaded.Value.FileKey)).IsSuccess);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientFileHandler(store, storage, client)
            .Handle(new GetClientFileQuery(uploaded.Value.FileKey)).Error!.Code);
        Assert.True(new GetClientFileHandler(store, storage, client).Handle(new GetClientFileQuery(clientFile.FileKey)).IsSuccess);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientFileHandler(store, storage, Client(PmsSeedConstants.SecondaryCustomerId))
            .Handle(new GetClientFileQuery(clientFile.FileKey)).Error!.Code);

        // A meter photo cannot be attached as a payment slip, and another customer's slip file is rejected.
        var invoice = store.GetAdminInvoices(Bkk, null, null).Value!.Items.Single(i => i.Customer.Id == PmsSeedConstants.SecondaryCustomerId);
        var submit = new SubmitClientPaymentSlipHandler(store, Client(PmsSeedConstants.SecondaryCustomerId), store, store);
        Assert.Equal(DomainErrorCodes.PermissionDenied, submit.Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(10m, clientFile.FileKey))).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, submit.Handle(new SubmitClientPaymentSlipCommand(invoice.Id, new SubmitPaymentSlipRequest(10m, uploaded.Value.FileKey))).Error!.Code);
    }

    [Fact]
    public void Cash_Flows_Should_Bind_To_The_Callers_Open_Shift_And_Show_Cashier_Name()
    {
        var store = new InMemoryOperationalService();
        var cashier = Admin("pimchanok.bkk", PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut, PermissionKeys.AdminCashierOperateShift);
        var shift = store.OpenAdminCashierShift(Bkk, cashier.UserId, new OpenCashierShiftRequest(1000m)).Value!;
        Assert.Equal("Pimchanok Srisawat", shift.Cashier.FullName);

        var stay = new CheckInStayHandler(store, cashier).Handle(new CheckInStayCommand(
            Bkk, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 300m)).Value!;
        var balance = store.GetAdminStays(Bkk, "Active", null).Value!.Items.Single(s => s.Id == stay.Id).Folio.BalanceDue;
        Assert.True(new RecordAdminFolioPaymentHandler(store, cashier, store)
            .Handle(new RecordAdminFolioPaymentCommand(Bkk, stay.Id, new RecordFolioPaymentRequest(balance, "Cash"))).IsSuccess);
        Assert.True(new CheckOutAdminStayHandler(store, cashier, store)
            .Handle(new CheckOutAdminStayCommand(Bkk, stay.Id, new CheckOutStayRequest(100m, "Lost keycard"))).IsSuccess);

        var bound = store.GetAdminCashierShift(Bkk, shift.Id).Value!;
        Assert.Equal(balance, bound.CashReceiptsInShift);
        Assert.Equal(300m, bound.CashDepositsReceivedInShift);
        Assert.Equal(200m, bound.CashDepositsRefundedInShift); // 300 deposit - 100 deduction kept in the drawer

        // Lease security deposit received at creation also lands on the open shift.
        var lease = new CreateAdminLeaseHandler(store, Admin("pimchanok.bkk", PermissionKeys.AdminLeasesManage), store)
            .Handle(new CreateAdminLeaseCommand(Bkk, new CreateLeaseRequest(
                PmsSeedConstants.DirtyUnitA102Id, PmsSeedConstants.SecondaryCustomerId,
                new DateOnly(2027, 1, 1), new DateOnly(2027, 12, 31), 6000m, 12000m, 0m, 0m)));
        Assert.True(lease.IsSuccess, lease.Error?.Message);
        Assert.Equal(300m + 12000m, store.GetAdminCashierShift(Bkk, shift.Id).Value!.CashDepositsReceivedInShift);
    }

    [Fact]
    public void Pdf_Renderer_Should_Produce_Pdf_For_Thai_Contract_And_Receipt()
    {
        var store = new InMemoryOperationalService();
        var renderer = new QuestPdfDocumentRenderer();
        var lease = store.GetAdminLeases(Bkk, "Active", null).Value!.Items.First();
        var leaseAdmin = Admin("leaser", PermissionKeys.AdminLeasesManage);
        var contract = new GetAdminLeaseContractPdfHandler(store, renderer, leaseAdmin, store)
            .Handle(new GetAdminLeaseContractPdfQuery(Bkk, lease.Id));
        Assert.True(contract.IsSuccess, contract.Error?.Message);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(contract.Value!.Content[..4]));
        Assert.Contains(store.AuditEvents, e => e.EntityId == lease.Id && e.Reason.StartsWith("Printed lease contract", StringComparison.Ordinal));
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetAdminLeaseContractPdfHandler(store, renderer, Admin("x", PermissionKeys.AdminBillingIssueBatch), store)
            .Handle(new GetAdminLeaseContractPdfQuery(Bkk, lease.Id)).Error!.Code);

        var invoice = store.GetAdminInvoices(Bkk, null, null).Value!.Items.Single(i => i.Customer.Id == PmsSeedConstants.SecondaryCustomerId);
        var slip = store.SubmitClientPaymentSlip(PmsSeedConstants.SecondaryCustomerId, invoice.Id, new SubmitPaymentSlipRequest(1200m, "legacy")).Value!;
        Assert.True(store.ApproveAdminPaymentSlip(Bkk, slip.Id, "pimchanok.bkk").IsSuccess);
        var receipt = Assert.Single(new GetAdminReceiptsHandler(store, Admin("v", PermissionKeys.AdminPaymentsVerifySlip))
            .Handle(new GetAdminReceiptsQuery(Bkk, invoice.Id)).Value!.Items);
        var clientPdf = new GetClientReceiptPdfHandler(store, renderer, Client(PmsSeedConstants.SecondaryCustomerId))
            .Handle(new GetClientReceiptPdfQuery(receipt.Id));
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(clientPdf.Value!.Content[..4]));
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientReceiptPdfHandler(store, renderer, Client(PmsSeedConstants.PrimaryCustomerId))
            .Handle(new GetClientReceiptPdfQuery(receipt.Id)).Error!.Code);
        Assert.Equal("Pimchanok Srisawat", store.GetAdminPaymentSlip(Bkk, slip.Id).Value!.ReviewedBy!.FullName);
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
