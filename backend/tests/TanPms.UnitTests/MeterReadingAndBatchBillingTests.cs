using TanPms.Application.Billing;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Meters;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class MeterReadingAndBatchBillingTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly Guid A201 = PmsSeedConstants.OccupiedMonthlyUnitA201Id;

    private static SaveMeterReadingsRequest Save(string period, decimal water, decimal electric, bool waterRollover = false, string? reason = null, string? photo = "meters/a201-water.jpg") =>
        new(period, [new MeterReadingInputDto(A201, water, electric, waterRollover, false, photo)], reason);

    private static TestCurrentUserContext Admin(params string[] permissions) => new()
    {
        IsAdminScope = true,
        AllowedPropertyIds = new HashSet<Guid> { Bkk },
        Permissions = new HashSet<string>(permissions)
    };

    [Fact]
    public void Rollover_Should_Be_Rejected_Until_Confirmed_Then_Use_Meter_Modulus_And_Flag_Anomaly()
    {
        var store = new InMemoryOperationalService();

        // Seed lease starts at 0; a jump to 9990 is saved but flagged as an anomaly (> 500 units).
        var september = store.SaveAdminMeterReadings(Bkk, Save("2026-09", 9990m, 9800m), callerCanOverrideLocked: false);
        Assert.True(september.Value!.IsSaved);
        Assert.Contains(september.Value.Rows[0].Warnings, w => w.Code == MeterReadingIssueCodes.UsageAnomaly && w.UtilityType == "Water");

        var unconfirmed = store.SaveAdminMeterReadings(Bkk, Save("2026-10", 15m, 9850m), callerCanOverrideLocked: false);
        Assert.False(unconfirmed.Value!.IsSaved);
        Assert.Contains(unconfirmed.Value.Rows[0].Errors, e => e.Code == DomainErrorCodes.MeterRolloverUnconfirmed && e.UtilityType == "Water");
        var sheetAfterReject = store.GetAdminMeterReadingSheet(Bkk, "2026-10", null).Value!;
        Assert.Null(Assert.Single(sheetAfterReject.Rows).Water.CurrentReading);

        var confirmed = store.SaveAdminMeterReadings(Bkk, Save("2026-10", 15m, 9850m, waterRollover: true), callerCanOverrideLocked: false);
        Assert.True(confirmed.Value!.IsSaved);
        var row = confirmed.Value.Rows[0];
        Assert.Equal(25m, row.Water!.UsageUnits); // (10^4 - 9990) + 15
        Assert.True(row.Water.UsedRollover);
        Assert.Equal(460m, row.Water.ChargeAmount); // 100 base + (25 - 5) * 18
        Assert.Equal(50m, row.Electric!.UsageUnits);
        Assert.Equal(400m, row.Electric.ChargeAmount);
        Assert.Empty(row.Warnings);

        var sheet = store.GetAdminMeterReadingSheet(Bkk, "2026-10", null).Value!;
        var sheetRow = Assert.Single(sheet.Rows);
        Assert.Equal("A-201", sheetRow.Unit.UnitNumber);
        Assert.Equal("1-xxxx-xxxxx-12-3", sheetRow.Customer.MaskedNationalId);
        Assert.Equal(4, sheetRow.Water.MeterMaxDigits);
        Assert.Equal(9990m, sheetRow.Water.PreviousReading);
        Assert.Equal(15m, sheetRow.Water.CurrentReading);
        Assert.True(sheetRow.Water.IsRolloverConfirmed);
        Assert.Equal("meters/a201-water.jpg", sheetRow.Water.PhotoFileKey);
        Assert.False(sheetRow.IsLocked);
    }

    [Fact]
    public void Bulk_Save_Should_Be_Atomic_When_Any_Row_Has_Errors()
    {
        var store = new InMemoryOperationalService();
        var request = new SaveMeterReadingsRequest(
            "2026-10",
            [
                new MeterReadingInputDto(A201, 10m, 20m),
                new MeterReadingInputDto(PmsSeedConstants.CleanUnitA101Id, 5m, -1m)
            ]);

        var result = store.SaveAdminMeterReadings(Bkk, request, callerCanOverrideLocked: false);

        Assert.False(result.Value!.IsSaved);
        Assert.Empty(result.Value.Rows[0].Errors);
        Assert.Contains(result.Value.Rows[1].Errors, e => e.Code == MeterReadingIssueCodes.NoActiveLease);
        Assert.Null(store.GetAdminMeterReadingSheet(Bkk, "2026-10", null).Value!.Rows[0].Water.CurrentReading);

        var badPeriod = store.SaveAdminMeterReadings(Bkk, request with { Period = "10/2026" }, false);
        Assert.Equal(DomainErrorCodes.ValidationFailed, badPeriod.Error!.Code);
    }

    [Fact]
    public void Locked_Period_Should_Require_Override_Permission_And_Reason_And_Be_Audited()
    {
        var store = new InMemoryOperationalService();

        // Seed invoice BKK01-INV-2611-0001 is Issued for the A-201 lease in 2026-11.
        Assert.True(Assert.Single(store.GetAdminMeterReadingSheet(Bkk, "2026-11", null).Value!.Rows).IsLocked);

        var recorder = new SaveAdminMeterReadingsHandler(store, Admin(PermissionKeys.AdminMetersRecord), store, store);
        var denied = recorder.Handle(new SaveAdminMeterReadingsCommand(Bkk, Save("2026-11", 10m, 20m, photo: null)));
        Assert.Contains(denied.Value!.Rows[0].Errors, e => e.Code == MeterReadingIssueCodes.PeriodLocked);

        var overrider = new SaveAdminMeterReadingsHandler(
            store, Admin(PermissionKeys.AdminMetersRecord, PermissionKeys.AdminMetersOverrideLocked), store, store);
        var noReason = overrider.Handle(new SaveAdminMeterReadingsCommand(Bkk, Save("2026-11", 10m, 20m, photo: null)));
        Assert.Contains(noReason.Value!.Rows[0].Errors, e => e.Code == MeterReadingIssueCodes.OverrideReasonRequired);

        var overridden = overrider.Handle(new SaveAdminMeterReadingsCommand(Bkk, Save("2026-11", 10m, 20m, reason: "Meter re-read after tenant dispute", photo: null)));
        Assert.True(overridden.Value!.IsSaved);
        Assert.True(overridden.Value.Rows[0].IsLockedOverride);
        Assert.Contains(store.AuditEvents, e =>
            e.ActionKey == PermissionKeys.AdminMetersOverrideLocked
            && e.EntityId == A201
            && e.Reason == "Meter re-read after tenant dispute");
    }

    [Fact]
    public void Batch_Run_Should_Be_Idempotent_Skip_Missing_Readings_Issue_With_Notification_And_Only_Delete_Drafts()
    {
        var store = new InMemoryOperationalService();
        var billing = Admin(PermissionKeys.AdminBillingIssueBatch);
        var lease = store.CreateAdminLease(Bkk, new Application.Leases.CreateLeaseRequest(
            PmsSeedConstants.DirtyUnitA102Id,
            PmsSeedConstants.SecondaryCustomerId,
            new DateOnly(2026, 10, 1),
            new DateOnly(2027, 9, 30),
            6500m,
            0m,
            0m,
            0m)).Value!;
        Assert.True(store.SaveAdminMeterReadings(Bkk, Save("2026-10", 12m, 80m), false).Value!.IsSaved);

        var run = new RunAdminBatchInvoicesHandler(store, billing, store)
            .Handle(new RunAdminBatchInvoicesCommand(Bkk, new BatchInvoiceRunRequest("2026-10")));
        Assert.True(run.IsSuccess, run.Error?.Message);
        var invoice = Assert.Single(run.Value!.Created);
        Assert.StartsWith("BKK01-INV-", invoice.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("Draft", invoice.Status);
        Assert.Equal("A-201", invoice.Unit!.UnitNumber);
        Assert.Equal(3, invoice.Lines.Count);
        Assert.Equal(8500m + 226m + 640m, invoice.TotalAmount); // water 100 + 7*18, electric 80*8
        Assert.Equal("1-xxxx-xxxxx-12-3", invoice.Customer.MaskedNationalId);
        var skip = Assert.Single(run.Value.Skipped);
        Assert.Equal(lease.Id, skip.LeaseId);
        Assert.Equal(BatchInvoiceSkipReasons.MissingMeterReadings, skip.ReasonCode);

        var rerun = store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10"));
        Assert.Empty(rerun.Value!.Created);
        Assert.Contains(rerun.Value.Skipped, s => s.ReasonCode == BatchInvoiceSkipReasons.InvoiceAlreadyExists);

        // Delete the draft, rerun recreates it (idempotency is per live invoice).
        var deleted = new DeleteAdminInvoiceHandler(store, billing, store).Handle(new DeleteAdminInvoiceCommand(Bkk, invoice.Id));
        Assert.True(deleted.IsSuccess);
        var recreated = Assert.Single(store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Created);

        var notificationsBefore = store.GetClientNotifications(PmsSeedConstants.PrimaryCustomerId).Value!.Items.Count;
        var issued = new IssueAdminInvoicesForPeriodHandler(store, billing, store, store)
            .Handle(new IssueAdminInvoicesForPeriodCommand(Bkk, new IssueInvoicesRequest("2026-10")));
        Assert.Equal("Issued", Assert.Single(issued.Value!.Issued).Status);
        Assert.Equal(notificationsBefore + 1, store.GetClientNotifications(PmsSeedConstants.PrimaryCustomerId).Value!.Items.Count);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminBillingIssueBatch && e.EntityId == recreated.Id);

        var deleteIssued = store.DeleteAdminInvoice(Bkk, recreated.Id);
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, deleteIssued.Error!.Code);
        var reissue = store.IssueAdminInvoice(Bkk, recreated.Id);
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, reissue.Error!.Code);

        // The issued invoice now locks the period's readings.
        Assert.True(store.GetAdminMeterReadingSheet(Bkk, "2026-10", null).Value!.Rows.Single(r => r.Unit.Id == A201).IsLocked);

        var listed = store.GetAdminInvoices(Bkk, "2026-10", "Issued");
        Assert.Equal(recreated.Id, Assert.Single(listed.Value!.Items).Id);
    }

    [Fact]
    public void Meter_And_Billing_Handlers_Should_Enforce_Property_Scope_And_Permissions()
    {
        var store = new InMemoryOperationalService();
        var otherProperty = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.CnxPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminMetersRecord, PermissionKeys.AdminBillingIssueBatch }
        };

        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminMeterReadingSheetHandler(store, otherProperty)
            .Handle(new GetAdminMeterReadingSheetQuery(Bkk, "2026-10", null)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminInvoicesHandler(store, otherProperty)
            .Handle(new GetAdminInvoicesQuery(Bkk, null, null)).Error!.Code);

        var meterOnly = Admin(PermissionKeys.AdminMetersRecord);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new RunAdminBatchInvoicesHandler(store, meterOnly, store)
            .Handle(new RunAdminBatchInvoicesCommand(Bkk, new BatchInvoiceRunRequest("2026-10"))).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new SaveAdminMeterReadingsHandler(store, Admin(PermissionKeys.AdminBillingIssueBatch), store, store)
            .Handle(new SaveAdminMeterReadingsCommand(Bkk, Save("2026-10", 1m, 1m))).Error!.Code);

        var masked = new GetAdminInvoicesHandler(store, Admin(PermissionKeys.AdminBillingIssueBatch))
            .Handle(new GetAdminInvoicesQuery(Bkk, "2026-11", null));
        Assert.All(masked.Value!.Items, i => Assert.DoesNotContain("1100501234123", i.Customer.MaskedNationalId));
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
