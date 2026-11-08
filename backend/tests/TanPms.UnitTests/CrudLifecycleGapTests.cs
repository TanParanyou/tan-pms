using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Housekeeping;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Parcels;
using TanPms.Application.Payments;
using TanPms.Application.WorkOrders;
using TanPms.Domain.Common;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

// Edit / delete / cancel / void flows that complete the PM-06..PM-09 CRUD matrix.
public sealed class CrudLifecycleGapTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly Guid A102 = PmsSeedConstants.DirtyUnitA102Id;
    private static readonly Guid A201 = PmsSeedConstants.OccupiedMonthlyUnitA201Id;

    private static TestCurrentUserContext Admin(params string[] permissions) => new()
    {
        UserId = "crud-admin",
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

    private static LeaseItemDto CreateA102Lease(InMemoryOperationalService store, DateOnly start, decimal deposit = 13000m) =>
        store.CreateAdminLease(Bkk, new CreateLeaseRequest(
            A102,
            PmsSeedConstants.SecondaryCustomerId,
            start,
            start.AddYears(1).AddDays(-1),
            6200m,
            deposit,
            5m,
            10m,
            [
                new LeaseOccupantRequest("Primary Tenant", "THA", "3100500000011", true),
                new LeaseOccupantRequest("Co Tenant", "THA", "3100500000022", false)
            ],
            [new LeaseVehicleRequest("1AB-1111", "Bangkok", "Honda")])).Value!;

    [Fact]
    public void Lease_Occupants_Vehicles_And_Terms_Should_Be_Editable_With_Guards_And_Audit()
    {
        var store = new InMemoryOperationalService();
        var leases = Admin(PermissionKeys.AdminLeasesManage);
        var lease = CreateA102Lease(store, new DateOnly(2026, 10, 1));
        var primary = lease.Occupants.Single(o => o.IsPrimaryOccupant);
        var co = lease.Occupants.Single(o => !o.IsPrimaryOccupant);

        // Blank IdentityNumber keeps the stored value; promoting the co-tenant demotes the old primary.
        var promoted = new UpdateAdminLeaseOccupantHandler(store, leases, store).Handle(new UpdateAdminLeaseOccupantCommand(
            Bkk, lease.Id, co.Id, new UpdateLeaseOccupantRequest("Co Tenant Renamed", "THA", null, true)));
        Assert.True(promoted.IsSuccess, promoted.Error?.Message);
        Assert.Equal(co.MaskedIdentityNumber, promoted.Value!.Occupants.Single(o => o.Id == co.Id).MaskedIdentityNumber);
        Assert.False(promoted.Value.Occupants.Single(o => o.Id == primary.Id).IsPrimaryOccupant);

        var demoteOnlyPrimary = store.UpdateAdminLeaseOccupant(Bkk, lease.Id, co.Id, new UpdateLeaseOccupantRequest("X", "THA", null, false));
        Assert.Equal(DomainErrorCodes.ValidationFailed, demoteOnlyPrimary.Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.DeleteAdminLeaseOccupant(Bkk, lease.Id, co.Id).Error!.Code);
        var deleted = new DeleteAdminLeaseOccupantHandler(store, leases, store).Handle(new DeleteAdminLeaseOccupantCommand(Bkk, lease.Id, primary.Id));
        Assert.Single(deleted.Value!.Occupants);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.DeleteAdminLeaseOccupant(Bkk, lease.Id, co.Id).Error!.Code);

        var vehicle = lease.Vehicles.Single();
        var editedVehicle = new UpdateAdminLeaseVehicleHandler(store, leases, store).Handle(new UpdateAdminLeaseVehicleCommand(
            Bkk, lease.Id, vehicle.Id, new LeaseVehicleRequest("1AB 1111", "Nonthaburi", "Honda Jazz")));
        Assert.Equal("Nonthaburi", editedVehicle.Value!.Vehicles.Single().Province);
        Assert.Empty(new DeleteAdminLeaseVehicleHandler(store, leases, store)
            .Handle(new DeleteAdminLeaseVehicleCommand(Bkk, lease.Id, vehicle.Id)).Value!.Vehicles);

        var updated = new UpdateAdminLeaseHandler(store, leases, store).Handle(new UpdateAdminLeaseCommand(
            Bkk, lease.Id, new UpdateLeaseRequest(6400m, 7m, null, "Agreed new rent from next cycle")));
        Assert.Equal(6400m, updated.Value!.MonthlyRentAmount);
        Assert.Equal(7m, updated.Value.InitialWaterMeterReading);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminLeasesManage && e.Reason == "Agreed new rent from next cycle");
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminLease(Bkk, lease.Id, new UpdateLeaseRequest(1m, null, null, " ")).Error!.Code);

        // Once readings exist for the lease, move-in readings are frozen.
        Assert.True(store.SaveAdminMeterReadings(Bkk, new SaveMeterReadingsRequest("2026-10",
            [new MeterReadingInputDto(A102, 20m, 30m, false, false, null)]), false).Value!.IsSaved);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminLease(Bkk, lease.Id, new UpdateLeaseRequest(null, 1m, null, "fix")).Error!.Code);
    }

    [Fact]
    public void Lease_Cancel_Should_Refund_Deposit_Vacate_Unit_And_Be_Blocked_By_Billed_Invoices()
    {
        var store = new InMemoryOperationalService();
        var settler = Admin(PermissionKeys.AdminLeasesSettleMoveOut);
        var lease = CreateA102Lease(store, new DateOnly(2026, 12, 1));

        Assert.Equal(DomainErrorCodes.PermissionDenied, new CancelAdminLeaseHandler(store, Admin(PermissionKeys.AdminLeasesManage), store)
            .Handle(new CancelAdminLeaseCommand(Bkk, lease.Id, new ReasonRequest("x"))).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.CancelAdminLease(Bkk, lease.Id, new ReasonRequest("")).Error!.Code);

        var cancelled = new CancelAdminLeaseHandler(store, settler, store)
            .Handle(new CancelAdminLeaseCommand(Bkk, lease.Id, new ReasonRequest("Tenant withdrew before move-in")));
        Assert.True(cancelled.IsSuccess, cancelled.Error?.Message);
        Assert.Equal("Cancelled", cancelled.Value!.Lease.Status);
        Assert.Equal(13000m, cancelled.Value.RefundedAmount);
        Assert.Equal(0m, cancelled.Value.Lease.SecurityDepositBalance);
        Assert.Equal("Pending", cancelled.Value.GeneratedHousekeepingTaskStatus);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminLeasesSettleMoveOut && e.Reason == "Tenant withdrew before move-in");

        // The seeded A-201 lease already has an Issued invoice, so it must go through move-out settlement.
        var seeded = store.GetAdminLeases(Bkk, "Active", null).Value!.Items.Single(l => l.Unit.Id == A201);
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, store.CancelAdminLease(Bkk, seeded.Id, new ReasonRequest("x")).Error!.Code);
    }

    [Fact]
    public void Meter_Reading_Delete_Should_Need_Override_And_Reason_Once_Period_Is_Locked()
    {
        var store = new InMemoryOperationalService();
        var recorder = Admin(PermissionKeys.AdminMetersRecord);
        var overrider = Admin(PermissionKeys.AdminMetersRecord, PermissionKeys.AdminMetersOverrideLocked);
        var save = new SaveMeterReadingsRequest("2026-10", [new MeterReadingInputDto(A201, 12m, 80m, false, false, null)]);
        Assert.True(store.SaveAdminMeterReadings(Bkk, save, false).Value!.IsSaved);

        var deleted = new DeleteAdminMeterReadingHandler(store, recorder, store).Handle(new DeleteAdminMeterReadingCommand(Bkk, A201, "2026-10", null));
        Assert.True(deleted.IsSuccess, deleted.Error?.Message);
        Assert.Null(deleted.Value!.Water.CurrentReading);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.DeleteAdminMeterReading(Bkk, A201, "2026-10", null, false).Error!.Code);

        // 2026-11 is locked by the seeded Issued invoice.
        Assert.True(store.SaveAdminMeterReadings(Bkk, new SaveMeterReadingsRequest("2026-11",
            [new MeterReadingInputDto(A201, 20m, 90m, false, false, null)], "initial read"), true).Value!.IsSaved);
        var handler = new DeleteAdminMeterReadingHandler(store, recorder, store);
        Assert.Equal(DomainErrorCodes.PermissionDenied, handler.Handle(new DeleteAdminMeterReadingCommand(Bkk, A201, "2026-11", "x")).Error!.Code);
        var overrideHandler = new DeleteAdminMeterReadingHandler(store, overrider, store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, overrideHandler.Handle(new DeleteAdminMeterReadingCommand(Bkk, A201, "2026-11", null)).Error!.Code);
        Assert.True(overrideHandler.Handle(new DeleteAdminMeterReadingCommand(Bkk, A201, "2026-11", "Wrong meter photographed")).IsSuccess);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminMetersOverrideLocked && e.Reason == "Wrong meter photographed");
    }

    [Fact]
    public void Draft_Invoice_Lines_Refresh_Proration_And_Void_Should_Follow_Billing_Rules()
    {
        var store = new InMemoryOperationalService();
        var billing = Admin(PermissionKeys.AdminBillingIssueBatch);
        // Lease starts 2026-10-11 → 21 of 31 days billable: 6200 x 21 / 31 = 4200.00.
        var lease = CreateA102Lease(store, new DateOnly(2026, 10, 11), deposit: 0m);
        Assert.True(store.SaveAdminMeterReadings(Bkk, new SaveMeterReadingsRequest("2026-10",
        [
            new MeterReadingInputDto(A201, 12m, 80m, false, false, null),
            new MeterReadingInputDto(A102, 10m, 20m, false, false, null)
        ]), false).Value!.IsSaved);

        var run = store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!;
        var prorated = run.Created.Single(i => i.LeaseDocumentNumber == lease.DocumentNumber);
        Assert.Equal(4200m, prorated.Lines[0].LineAmount);
        Assert.Contains("21/31", prorated.Lines[0].Description.En, StringComparison.Ordinal);
        var draft = run.Created.Single(i => i.Unit!.Id == A201);
        Assert.Equal("VatIncluded", draft.Lines[1].TaxMode); // seeded UTILITY_WATER profile
        Assert.Equal(8500m + 226m + 640m, draft.TotalAmount);

        // Reading change → rerun re-prices only the Draft, idempotently.
        Assert.True(store.SaveAdminMeterReadings(Bkk, new SaveMeterReadingsRequest("2026-10",
            [new MeterReadingInputDto(A201, 15m, 80m, false, false, null)]), false).Value!.IsSaved);
        var refreshedRun = new RunAdminBatchInvoicesHandler(store, billing, store).Handle(new RunAdminBatchInvoicesCommand(Bkk, new BatchInvoiceRunRequest("2026-10"))).Value!;
        var refreshed = refreshedRun.Refreshed.Single(i => i.Id == draft.Id);
        Assert.Equal(8500m + 280m + 640m, refreshed.TotalAmount); // water 100 + 10*18
        Assert.Empty(store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Refreshed);

        var line = new InvoiceLineRequest(new LocalizedTextDto("ค่าที่จอดรถ", "Parking"), 500m, "VatIncluded");
        var added = new AddAdminInvoiceLineHandler(store, billing, store).Handle(new AddAdminInvoiceLineCommand(Bkk, draft.Id, line));
        Assert.Equal(4, added.Value!.Lines.Count);
        var parkingId = added.Value.Lines[3].Id;
        var edited = new UpdateAdminInvoiceLineHandler(store, billing, store)
            .Handle(new UpdateAdminInvoiceLineCommand(Bkk, draft.Id, parkingId, line with { LineAmount = 600m }));
        Assert.Equal(600m, edited.Value!.Lines[3].LineAmount);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.AddAdminInvoiceLine(Bkk, draft.Id, line with { TaxMode = "Bogus" }).Error!.Code);
        var removed = new DeleteAdminInvoiceLineHandler(store, billing, store)
            .Handle(new DeleteAdminInvoiceLineCommand(Bkk, draft.Id, edited.Value.Lines[3].Id));
        Assert.Equal(3, removed.Value!.Lines.Count);
        Assert.Equal(draft.Id, new GetAdminInvoiceHandler(store, billing).Handle(new GetAdminInvoiceQuery(Bkk, draft.Id)).Value!.Id);

        // Void: Draft must be deleted, Issued needs AdminInvoicesVoid + reason, and money on the invoice blocks it.
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, store.VoidAdminInvoice(Bkk, draft.Id, new ReasonRequest("x")).Error!.Code);
        Assert.True(store.IssueAdminInvoice(Bkk, draft.Id).IsSuccess);
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, store.AddAdminInvoiceLine(Bkk, draft.Id, line).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new VoidAdminInvoiceHandler(store, billing, store)
            .Handle(new VoidAdminInvoiceCommand(Bkk, draft.Id, new ReasonRequest("x"))).Error!.Code);
        var voider = Admin(PermissionKeys.AdminInvoicesVoid);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new VoidAdminInvoiceHandler(store, voider, store)
            .Handle(new VoidAdminInvoiceCommand(Bkk, draft.Id, new ReasonRequest(" "))).Error!.Code);

        var slip = store.SubmitClientPaymentSlip(PmsSeedConstants.PrimaryCustomerId, draft.Id, new SubmitPaymentSlipRequest(100m, "slips/x.jpg")).Value!;
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, store.VoidAdminInvoice(Bkk, draft.Id, new ReasonRequest("x")).Error!.Code);
        Assert.True(store.RejectAdminPaymentSlip(Bkk, slip.Id, "checker", new RejectPaymentSlipRequest("Blurry")).IsSuccess);
        var voided = new VoidAdminInvoiceHandler(store, voider, store)
            .Handle(new VoidAdminInvoiceCommand(Bkk, draft.Id, new ReasonRequest("Billed wrong tenant")));
        Assert.Equal("Voided", voided.Value!.Status);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminInvoicesVoid && e.Reason == "Billed wrong tenant");
    }

    [Fact]
    public void Cashier_Shift_Cancel_And_Remark_Edit_Should_Respect_Status_Owner_And_Activity()
    {
        var store = new InMemoryOperationalService();
        var cashier = Admin(PermissionKeys.AdminCashierOperateShift);
        var shift = store.OpenAdminCashierShift(Bkk, cashier.UserId, new OpenCashierShiftRequest(500m)).Value!;

        var otherCashier = new TestCurrentUserContext
        {
            UserId = "other-cashier",
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { Bkk },
            Permissions = new HashSet<string> { PermissionKeys.AdminCashierOperateShift }
        };
        Assert.Equal(DomainErrorCodes.PermissionDenied, new CancelAdminCashierShiftHandler(store, otherCashier, store)
            .Handle(new CancelAdminCashierShiftCommand(Bkk, shift.Id, new ReasonRequest("x"))).Error!.Code);
        var cancelled = new CancelAdminCashierShiftHandler(store, cashier, store)
            .Handle(new CancelAdminCashierShiftCommand(Bkk, shift.Id, new ReasonRequest("Opened on wrong property")));
        Assert.Equal("Cancelled", cancelled.Value!.Status);
        Assert.False(store.HasOpenCashierShift(cashier.UserId, new HashSet<Guid> { Bkk }));

        // The single open slot is free again; a shift with cash activity cannot be cancelled.
        var second = store.OpenAdminCashierShift(Bkk, cashier.UserId, new OpenCashierShiftRequest(500m)).Value!;
        var closed = store.CloseAdminCashierShift(Bkk, second.Id, cashier.UserId, new CloseCashierShiftRequest(480m, "Short 20")).Value!;
        Assert.Equal(DomainErrorCodes.ShiftNotOpen, store.CancelAdminCashierShift(Bkk, closed.Id, null, new ReasonRequest("x")).Error!.Code);

        var remark = new UpdateAdminCashierShiftRemarkHandler(store, cashier, store)
            .Handle(new UpdateAdminCashierShiftRemarkCommand(Bkk, closed.Id, new UpdateCashierShiftRemarkRequest("Short 20: coin miscount")));
        Assert.Equal("Short 20: coin miscount", remark.Value!.VarianceRemark);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminCashierShiftRemark(Bkk, closed.Id, null, new UpdateCashierShiftRemarkRequest(" ")).Error!.Code);
        Assert.True(store.ReconcileAdminCashierShift(Bkk, closed.Id).IsSuccess);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminCashierShiftRemark(Bkk, closed.Id, null, new UpdateCashierShiftRemarkRequest("late")).Error!.Code);
        Assert.Equal("Reconciled", new GetAdminCashierShiftHandler(store, cashier).Handle(new GetAdminCashierShiftQuery(Bkk, closed.Id)).Value!.Status);
    }

    [Fact]
    public void Client_Slip_Edit_And_Withdraw_Should_Enforce_Ownership_Pending_Status_And_Outstanding()
    {
        var store = new InMemoryOperationalService();
        var invoice = store.GetAdminInvoices(Bkk, null, null).Value!.Items.Single(i => i.Customer.Id == PmsSeedConstants.SecondaryCustomerId);
        var owner = Client(PmsSeedConstants.SecondaryCustomerId);
        var slipB = TestFiles.Client(store, StoredFilePurpose.PaymentSlip, PmsSeedConstants.SecondaryCustomerId);
        var slip = store.SubmitClientPaymentSlip(PmsSeedConstants.SecondaryCustomerId, invoice.Id, new SubmitPaymentSlipRequest(500m, "slips/a.jpg")).Value!;

        var edited = new UpdateClientPaymentSlipHandler(store, owner, store, store)
            .Handle(new UpdateClientPaymentSlipCommand(invoice.Id, slip.Id, new SubmitPaymentSlipRequest(1200m, slipB, "KBANK-9")));
        Assert.Equal(1200m, edited.Value!.Amount);
        Assert.Equal(slipB, edited.Value.SlipFileKey);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateClientPaymentSlip(
            PmsSeedConstants.SecondaryCustomerId, invoice.Id, slip.Id, new SubmitPaymentSlipRequest(5000m, "slips/b.jpg")).Error!.Code);

        var stranger = new WithdrawClientPaymentSlipHandler(store, Client(PmsSeedConstants.PrimaryCustomerId), store)
            .Handle(new WithdrawClientPaymentSlipCommand(invoice.Id, slip.Id));
        Assert.Equal(DomainErrorCodes.PermissionDenied, stranger.Error!.Code);
        Assert.True(new WithdrawClientPaymentSlipHandler(store, owner, store).Handle(new WithdrawClientPaymentSlipCommand(invoice.Id, slip.Id)).IsSuccess);
        Assert.Empty(store.GetClientInvoiceSlips(PmsSeedConstants.SecondaryCustomerId, invoice.Id).Value!.Items);

        var approvedSlip = store.SubmitClientPaymentSlip(PmsSeedConstants.SecondaryCustomerId, invoice.Id, new SubmitPaymentSlipRequest(100m, "slips/c.jpg")).Value!;
        Assert.True(store.ApproveAdminPaymentSlip(Bkk, approvedSlip.Id, "checker").IsSuccess);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.WithdrawClientPaymentSlip(PmsSeedConstants.SecondaryCustomerId, invoice.Id, approvedSlip.Id).Error!.Code);
        var adminView = new GetAdminPaymentSlipHandler(store, Admin(PermissionKeys.AdminPaymentsVerifySlip))
            .Handle(new GetAdminPaymentSlipQuery(Bkk, approvedSlip.Id));
        Assert.Equal("Approved", adminView.Value!.Status);
    }

    [Fact]
    public void Housekeeping_WorkOrder_And_Parcel_Edit_Cancel_Void_Should_Follow_Status_Rules()
    {
        var store = new InMemoryOperationalService();
        var housekeeper = Admin(PermissionKeys.AdminHousekeepingUpdate);
        var created = new CreateAdminHousekeepingTaskHandler(store, housekeeper, store)
            .Handle(new CreateAdminHousekeepingTaskCommand(Bkk, new CreateHousekeepingTaskRequest(A201, "Deep clean curtains")));
        Assert.Equal("MANUAL", created.Value!.SourceDocumentNumber);
        Assert.Equal("Deep clean curtains", created.Value.Note);
        var updated = new UpdateAdminHousekeepingTaskHandler(store, housekeeper, store)
            .Handle(new UpdateAdminHousekeepingTaskCommand(Bkk, created.Value.Id, new UpdateHousekeepingTaskRequest("maid-02", "Bring ladder")));
        Assert.Equal("maid-02", updated.Value!.AssignedStaffUserId);
        var deleted = new DeleteAdminHousekeepingTaskHandler(store, housekeeper, store)
            .Handle(new DeleteAdminHousekeepingTaskCommand(Bkk, created.Value.Id));
        Assert.True(deleted.IsSuccess);
        Assert.DoesNotContain(store.GetAdminHousekeepingTasks(Bkk, null, null).Value!.Items, t => t.Id == created.Value.Id);

        var tenant = Client(PmsSeedConstants.PrimaryCustomerId);
        var workOrder = store.CreateClientWorkOrder(PmsSeedConstants.PrimaryCustomerId, new CreateWorkOrderRequest(A201, "Leaky tap")).Value!;
        var clientEdit = new UpdateClientWorkOrderHandler(store, tenant, store, store)
            .Handle(new UpdateClientWorkOrderCommand(workOrder.Id, new UpdateWorkOrderRequest("Leaky kitchen tap", "Drips all night", "High")));
        Assert.Equal("High", clientEdit.Value!.Priority);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new GetClientWorkOrderHandler(store, Client(PmsSeedConstants.SecondaryCustomerId))
            .Handle(new GetClientWorkOrderQuery(workOrder.Id)).Error!.Code);
        var ops = Admin(PermissionKeys.AdminWorkOrdersManage);
        Assert.True(store.AssignAdminWorkOrder(Bkk, workOrder.Id, new AssignWorkOrderRequest("tech-1")).IsSuccess);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.CancelClientWorkOrder(PmsSeedConstants.PrimaryCustomerId, workOrder.Id, new ReasonRequest("x")).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminWorkOrder(Bkk, workOrder.Id, new UpdateWorkOrderRequest("x")).Error!.Code);
        var cancelled = new CancelAdminWorkOrderHandler(store, ops, store)
            .Handle(new CancelAdminWorkOrderCommand(Bkk, workOrder.Id, new ReasonRequest("Tenant fixed it")));
        Assert.Equal("Cancelled", cancelled.Value!.Status);
        Assert.Equal("Tenant fixed it", cancelled.Value.CancelReason);

        var charged = store.CreateAdminWorkOrder(Bkk, new CreateWorkOrderRequest(A201, "Broken door")).Value!;
        Assert.True(store.AssignAdminWorkOrder(Bkk, charged.Id, new AssignWorkOrderRequest("tech-1")).IsSuccess);
        Assert.True(store.ResolveAdminWorkOrder(Bkk, charged.Id, new ResolveWorkOrderRequest("Fixed", null, 300m, true)).IsSuccess);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.CancelAdminWorkOrder(Bkk, charged.Id, new ReasonRequest("x")).Error!.Code);

        var parcels = Admin(PermissionKeys.AdminParcelsManage);
        var parcel = store.GetAdminParcels(Bkk, "Arrived").Value!.Items.First();
        var editedParcel = new UpdateAdminParcelHandler(store, parcels, store, store)
            .Handle(new UpdateAdminParcelCommand(Bkk, parcel.Id, new ReceiveParcelRequest(A201, "Flash Express", "FLA-1")));
        Assert.Equal("Flash Express", editedParcel.Value!.CarrierName);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminParcel(Bkk, parcel.Id, new ReceiveParcelRequest(A102, "Flash")).Error!.Code);
        Assert.Equal(parcel.Id, new GetClientParcelHandler(store, tenant).Handle(new GetClientParcelQuery(parcel.Id)).Value!.Id);
        var voided = new VoidAdminParcelHandler(store, parcels, store)
            .Handle(new VoidAdminParcelCommand(Bkk, parcel.Id, new ReasonRequest("Logged twice")));
        Assert.True(voided.IsSuccess);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new GetAdminParcelHandler(store, parcels).Handle(new GetAdminParcelQuery(Bkk, parcel.Id)).Error!.Code);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminParcelsManage && e.Reason == "Logged twice");
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
