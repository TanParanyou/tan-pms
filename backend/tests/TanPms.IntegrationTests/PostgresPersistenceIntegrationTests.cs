using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Customers;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Payments;
using TanPms.Application.Rack;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Identity;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class PostgresPersistenceIntegrationTests
{
    private const string AdminConnectionString =
        "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres;Timeout=2";

    [Fact]
    public async Task Postgres_Migrations_Seed_AtomicDocumentNumbering_GiSTExclusion_And_WebApi_Should_Work_EndToEnd()
    {
        if (!await IsLocalPostgresAvailableAsync())
        {
            return;
        }

        var testDbName = $"tan_pms_it_{Guid.NewGuid():N}";
        var testConnStr = $"Host=localhost;Port=5432;Database={testDbName};Username=postgres;Password=postgres";

        try
        {
            await using var factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.UseEnvironment("Production");
                    builder.UseSetting("Persistence:Provider", "Postgres");
                    builder.UseSetting("ConnectionStrings:DefaultConnection", testConnStr);
                });

            // 1. Apply migrations & idempotent seed
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
                var docService = scope.ServiceProvider.GetRequiredService<IDocumentNumberService>();
                Assert.IsType<PostgresDocumentNumberService>(docService);

                await db.Database.MigrateAsync();
                await PmsDatabaseInitializer.SeedIfEmptyAsync(db, docService);
                // Second call must be idempotent
                await PmsDatabaseInitializer.SeedIfEmptyAsync(db, docService);

                Assert.Equal(2, await db.Properties.CountAsync());
                var bkk = await db.Properties.AsNoTracking().SingleAsync(p => p.Id == PmsSeedConstants.BkkPropertyId);
                Assert.Equal("แทน เรสซิเดนซ์ รัชดา", bkk.Name.Thai);
                Assert.Equal("TAN Residence Ratchada", bkk.Name.English);
                Assert.NotEqual(default, bkk.CreatedAt);
            }

            // 2. Verify 20-way parallel atomic sequence generation produces 0001..0020 with zero duplicates
            var issuedAt = new DateTimeOffset(2026, 11, 7, 10, 0, 0, TimeSpan.Zero);
            var docTasks = Enumerable.Range(0, 20).Select(async _ =>
            {
                using var scope = factory.Services.CreateScope();
                var docService = scope.ServiceProvider.GetRequiredService<IDocumentNumberService>();
                return await docService.NextDocumentNumberAsync(
                    PmsSeedConstants.BkkPropertyId,
                    "BKK01",
                    DocumentTypeCode.SHF,
                    issuedAt);
            });

            var generatedNumbers = await Task.WhenAll(docTasks);
            Assert.Equal(20, generatedNumbers.Distinct(StringComparer.Ordinal).Count());
            for (var seq = 1; seq <= 20; seq++)
            {
                Assert.Contains($"BKK01-SHF-2611-{seq:0000}", generatedNumbers);
            }

            // 3. Verify PostgreSQL GiST exclusion constraints reject overlapping Reservations & Stays at DB level
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
                var baseStart = new DateTimeOffset(2027, 3, 10, 14, 0, 0, TimeSpan.Zero);

                var res1 = Reservation.CreateByAdmin(
                    propertyId: PmsSeedConstants.BkkPropertyId,
                    documentNumber: "BKK01-RES-2703-9001",
                    customerId: PmsSeedConstants.PrimaryCustomerId,
                    unitTypeId: PmsSeedConstants.StandardUnitTypeId,
                    stayMode: StayMode.Daily,
                    slotStartAt: baseStart,
                    slotEndAt: baseStart.AddDays(2),
                    depositAmount: 500m,
                    nowUtc: baseStart.AddDays(-1),
                    confirmImmediately: true,
                    unitId: PmsSeedConstants.CleanUnitA101Id);

                db.Reservations.Add(res1);
                await db.SaveChangesAsync();

                var overlappingRes = Reservation.CreateByAdmin(
                    propertyId: PmsSeedConstants.BkkPropertyId,
                    documentNumber: "BKK01-RES-2703-9002",
                    customerId: PmsSeedConstants.SecondaryCustomerId,
                    unitTypeId: PmsSeedConstants.StandardUnitTypeId,
                    stayMode: StayMode.Daily,
                    slotStartAt: baseStart.AddDays(1),
                    slotEndAt: baseStart.AddDays(3),
                    depositAmount: 500m,
                    nowUtc: baseStart.AddDays(-1),
                    confirmImmediately: true,
                    unitId: PmsSeedConstants.CleanUnitA101Id);

                db.Reservations.Add(overlappingRes);
                var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
                var pgEx = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23P01", pgEx.SqlState);
            }

            // 4. Verify real HTTP endpoints backed by EfCorePmsStore + PostgreSQL
            using var adminClient = factory.CreateClient();
            adminClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            adminClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            adminClient.DefaultRequestHeaders.Add("X-TanPms-Open-Shift", "true");
            adminClient.DefaultRequestHeaders.Add(
                "X-TanPms-Permissions",
                string.Join(",", PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut));

            var rackRes = await adminClient.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rack");
            Assert.Equal(HttpStatusCode.OK, rackRes.StatusCode);
            var rack = await rackRes.Content.ReadFromJsonAsync<RoomRackResponse>();
            Assert.NotNull(rack);
            Assert.Equal(3, rack.Items.Count);

            var checkInRes = await adminClient.PostAsJsonAsync(
                "/api/v1/admin/stays/check-in",
                new CheckInStayRequest(
                    PropertyId: PmsSeedConstants.BkkPropertyId,
                    UnitId: PmsSeedConstants.CleanUnitA101Id,
                    CustomerId: PmsSeedConstants.PrimaryCustomerId,
                    StayMode: "Hourly",
                    KeyDepositAmount: 300m));
            Assert.Equal(HttpStatusCode.Created, checkInRes.StatusCode);
            var staySummary = await checkInRes.Content.ReadFromJsonAsync<StaySummaryDto>();
            Assert.NotNull(staySummary);

            var payRes = await adminClient.PostAsJsonAsync(
                $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{staySummary.Id}/folio/payments",
                new RecordFolioPaymentRequest(500m, "Cash"));
            Assert.Equal(HttpStatusCode.OK, payRes.StatusCode);

            var checkOutRes = await adminClient.PostAsJsonAsync(
                $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{staySummary.Id}/check-out",
                new CheckOutStayRequest(0m, "Keycard returned intact"));
            Assert.Equal(HttpStatusCode.OK, checkOutRes.StatusCode);
            var checkedOut = await checkOutRes.Content.ReadFromJsonAsync<StayDetailDto>();
            Assert.NotNull(checkedOut);
            Assert.Equal("CheckedOut", checkedOut.Status);
            Assert.Equal("Pending", checkedOut.GeneratedHousekeepingTaskStatus);

            // 5. PM-06 monthly lease lifecycle through EfCorePmsStore + PostgreSQL
            using var leaseClient = factory.CreateClient();
            leaseClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            leaseClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            leaseClient.DefaultRequestHeaders.Add(
                "X-TanPms-Permissions",
                string.Join(",", PermissionKeys.AdminLeasesManage, PermissionKeys.AdminLeasesSettleMoveOut));
            var leasesUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/leases";

            var createLeaseRes = await leaseClient.PostAsJsonAsync(leasesUrl, new CreateLeaseRequest(
                UnitId: PmsSeedConstants.DirtyUnitA102Id,
                CustomerId: PmsSeedConstants.SecondaryCustomerId,
                StartDate: new DateOnly(2027, 6, 1),
                EndDate: new DateOnly(2027, 11, 30),
                MonthlyRentAmount: 6500m,
                SecurityDepositAmount: 10000m,
                InitialWaterMeterReading: 120m,
                InitialElectricMeterReading: 4500m,
                Vehicles: [new LeaseVehicleRequest("2กค 1234", "Bangkok", "Honda City")]));
            Assert.Equal(HttpStatusCode.Created, createLeaseRes.StatusCode);
            var createdLease = await createLeaseRes.Content.ReadFromJsonAsync<LeaseItemDto>();
            Assert.NotNull(createdLease);
            Assert.StartsWith("BKK01-LSE-", createdLease.DocumentNumber, StringComparison.Ordinal);
            Assert.Equal(10000m, createdLease.SecurityDepositBalance);
            Assert.Single(createdLease.Occupants);

            var addOccupantRes = await leaseClient.PostAsJsonAsync(
                $"{leasesUrl}/{createdLease.Id}/occupants",
                new LeaseOccupantRequest("Co Tenant", "THA", "1100700000001", false));
            Assert.Equal(HttpStatusCode.OK, addOccupantRes.StatusCode);

            var renewRes = await leaseClient.PostAsJsonAsync(
                $"{leasesUrl}/{createdLease.Id}/renew",
                new RenewLeaseRequest(new DateOnly(2028, 5, 31), 6800m));
            Assert.Equal(HttpStatusCode.OK, renewRes.StatusCode);

            var plateRes = await leaseClient.GetFromJsonAsync<LeaseListResponse>($"{leasesUrl}?licensePlate=2กค-1234");
            Assert.NotNull(plateRes);
            var found = Assert.Single(plateRes.Items);
            Assert.Equal(2, found.Occupants.Count);
            Assert.Equal(6800m, found.MonthlyRentAmount);

            var leaseById = await leaseClient.GetFromJsonAsync<LeaseItemDto>($"{leasesUrl}/{createdLease.Id}");
            Assert.NotNull(leaseById);
            Assert.Equal(createdLease.DocumentNumber, leaseById.DocumentNumber);

            var customerLookup = await leaseClient.GetFromJsonAsync<CustomerListResponse>(
                $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/customers?search=6541");
            Assert.NotNull(customerLookup);
            var lookedUp = Assert.Single(customerLookup.Items);
            Assert.Equal(PmsSeedConstants.SecondaryCustomerId, lookedUp.Id);
            Assert.Equal("3-xxxx-xxxxx-54-1", lookedUp.MaskedNationalId);

            Assert.Equal(HttpStatusCode.OK, (await leaseClient.PostAsync($"{leasesUrl}/{createdLease.Id}/move-out-notice", null)).StatusCode);
            var settleLeaseRes = await leaseClient.PostAsJsonAsync(
                $"{leasesUrl}/{createdLease.Id}/settle-move-out",
                new SettleLeaseMoveOutRequest(1500m, 500m, "Final utilities and wall repair"));
            Assert.Equal(HttpStatusCode.OK, settleLeaseRes.StatusCode);
            var settlement = await settleLeaseRes.Content.ReadFromJsonAsync<LeaseSettlementDto>();
            Assert.NotNull(settlement);
            Assert.Equal(8000m, settlement.RefundedAmount);
            Assert.Equal(0m, settlement.Lease.SecurityDepositBalance);
            Assert.Equal("MovedOut", settlement.Lease.Status);

            using var clientApp = factory.CreateClient();
            clientApp.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
            clientApp.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.PrimaryCustomerId.ToString());

            var dashRes = await clientApp.GetAsync("/api/v1/client/dashboard");
            Assert.Equal(HttpStatusCode.OK, dashRes.StatusCode);
            var dash = await dashRes.Content.ReadFromJsonAsync<ClientDashboardResponse>();
            Assert.NotNull(dash);
            Assert.NotNull(dash.ActiveLease);
            Assert.Single(dash.UnpaidInvoices);
            Assert.Single(dash.PendingParcels);

            // 6. PM-07 bulk meter reading + batch billing through EfCorePmsStore + PostgreSQL
            using var billingClient = factory.CreateClient();
            billingClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            billingClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            billingClient.DefaultRequestHeaders.Add(
                "X-TanPms-Permissions",
                string.Join(",", PermissionKeys.AdminMetersRecord, PermissionKeys.AdminBillingIssueBatch));
            var bkkUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}";

            var rejectRes = await billingClient.PutAsJsonAsync($"{bkkUrl}/meter-readings", new SaveMeterReadingsRequest(
                "2026-09",
                [
                    new MeterReadingInputDto(PmsSeedConstants.OccupiedMonthlyUnitA201Id, 9990m, 9800m),
                    new MeterReadingInputDto(PmsSeedConstants.CleanUnitA101Id, 1m, 1m)
                ]));
            var rejected = await rejectRes.Content.ReadFromJsonAsync<SaveMeterReadingsResponse>();
            Assert.NotNull(rejected);
            Assert.False(rejected.IsSaved);

            var septRes = await billingClient.PutAsJsonAsync($"{bkkUrl}/meter-readings", new SaveMeterReadingsRequest(
                "2026-09",
                [new MeterReadingInputDto(PmsSeedConstants.OccupiedMonthlyUnitA201Id, 9990m, 9800m)]));
            var sept = await septRes.Content.ReadFromJsonAsync<SaveMeterReadingsResponse>();
            Assert.True(sept!.IsSaved);
            Assert.NotEmpty(sept.Rows[0].Warnings);

            var octRes = await billingClient.PutAsJsonAsync($"{bkkUrl}/meter-readings", new SaveMeterReadingsRequest(
                "2026-10",
                [new MeterReadingInputDto(PmsSeedConstants.OccupiedMonthlyUnitA201Id, 15m, 9850m, WaterRolloverConfirmed: true)]));
            var oct = await octRes.Content.ReadFromJsonAsync<SaveMeterReadingsResponse>();
            Assert.True(oct!.IsSaved);
            Assert.Equal(25m, oct.Rows[0].Water!.UsageUnits);

            // Re-save the same period upserts instead of violating the unique index.
            var octAgain = await (await billingClient.PutAsJsonAsync($"{bkkUrl}/meter-readings", new SaveMeterReadingsRequest(
                "2026-10",
                [new MeterReadingInputDto(PmsSeedConstants.OccupiedMonthlyUnitA201Id, 15m, 9850m, WaterRolloverConfirmed: true)])))
                .Content.ReadFromJsonAsync<SaveMeterReadingsResponse>();
            Assert.True(octAgain!.IsSaved);

            var octSheet = await billingClient.GetFromJsonAsync<MeterReadingSheetResponse>($"{bkkUrl}/meter-readings?period=2026-10");
            var octRow = Assert.Single(octSheet!.Rows, r => r.Unit.Id == PmsSeedConstants.OccupiedMonthlyUnitA201Id);
            Assert.Equal(9990m, octRow.Water.PreviousReading);
            Assert.Equal(15m, octRow.Water.CurrentReading);

            var runRes = await billingClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs", new BatchInvoiceRunRequest("2026-10"));
            Assert.Equal(HttpStatusCode.OK, runRes.StatusCode);
            var run = await runRes.Content.ReadFromJsonAsync<BatchInvoiceRunResponse>();
            var draft = Assert.Single(run!.Created);
            Assert.Equal(8500m + 460m + 400m, draft.TotalAmount);

            var rerun = await (await billingClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs", new BatchInvoiceRunRequest("2026-10")))
                .Content.ReadFromJsonAsync<BatchInvoiceRunResponse>();
            Assert.Empty(rerun!.Created);

            Assert.Equal(HttpStatusCode.OK, (await billingClient.DeleteAsync($"{bkkUrl}/invoices/{draft.Id}")).StatusCode);
            var recreated = Assert.Single((await (await billingClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs", new BatchInvoiceRunRequest("2026-10")))
                .Content.ReadFromJsonAsync<BatchInvoiceRunResponse>())!.Created);
            Assert.Equal(3, recreated.Lines.Count);

            var issueRes = await billingClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs/issue", new IssueInvoicesRequest("2026-10"));
            var issued = await issueRes.Content.ReadFromJsonAsync<InvoiceIssueResponse>();
            Assert.Equal("Issued", Assert.Single(issued!.Issued).Status);
            Assert.Equal(HttpStatusCode.Conflict, (await billingClient.DeleteAsync($"{bkkUrl}/invoices/{recreated.Id}")).StatusCode);

            var feed = await clientApp.GetFromJsonAsync<NotificationListResponse>("/api/v1/client/notifications");
            Assert.Contains(feed!.Items, n => n.TemplateKey == InvoiceIssuedNotification.TemplateKey);

            // 7. PM-08 cashier shift, slip verification and deposit register through EfCorePmsStore + PostgreSQL
            using var cashierClient = factory.CreateClient();
            cashierClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            cashierClient.DefaultRequestHeaders.Add("X-TanPms-User-Id", "pg-cashier");
            cashierClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            cashierClient.DefaultRequestHeaders.Add(
                "X-TanPms-Permissions",
                string.Join(",", PermissionKeys.AdminCashierOperateShift, PermissionKeys.AdminPaymentsVerifySlip));

            // No X-TanPms-Open-Shift header: HasOpenCashierShift reflects real shifts, so check-in is blocked until a shift opens.
            var blockedCheckIn = await cashierClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", new CheckInStayRequest(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Hourly",
                KeyDepositAmount: 0m));
            Assert.Equal(HttpStatusCode.Conflict, blockedCheckIn.StatusCode);

            var shiftRes = await cashierClient.PostAsJsonAsync($"{bkkUrl}/cashier/shifts/open", new OpenCashierShiftRequest(1000m));
            Assert.Equal(HttpStatusCode.Created, shiftRes.StatusCode);
            var shift = await shiftRes.Content.ReadFromJsonAsync<CashierShiftDto>();
            Assert.Equal(HttpStatusCode.BadRequest, (await cashierClient.PostAsJsonAsync($"{bkkUrl}/cashier/shifts/open", new OpenCashierShiftRequest(1m))).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await cashierClient.PostAsJsonAsync(
                $"{bkkUrl}/cashier/shifts/{shift!.Id}/close", new CloseCashierShiftRequest(990m))).StatusCode);
            var closedShift = await (await cashierClient.PostAsJsonAsync(
                $"{bkkUrl}/cashier/shifts/{shift.Id}/close", new CloseCashierShiftRequest(990m, "Short 10")))
                .Content.ReadFromJsonAsync<CashierShiftDto>();
            Assert.Equal(-10m, closedShift!.CashVariance);
            Assert.Equal(HttpStatusCode.Forbidden, (await cashierClient.PostAsJsonAsync(
                $"{bkkUrl}/cashier/shifts/{shift.Id}/reconcile", new ReconcileCashierShiftRequest())).StatusCode);

            using var supervisorClient = factory.CreateClient();
            supervisorClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            supervisorClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            supervisorClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminCashierReconcileShift);
            var reconciledShift = await (await supervisorClient.PostAsJsonAsync(
                $"{bkkUrl}/cashier/shifts/{shift.Id}/reconcile", new ReconcileCashierShiftRequest("Checked")))
                .Content.ReadFromJsonAsync<CashierShiftDto>();
            Assert.Equal("Reconciled", reconciledShift!.Status);

            var pgInvoices = await billingClient.GetFromJsonAsync<InvoiceListResponse>($"{bkkUrl}/invoices");
            var pgInvoice2 = pgInvoices!.Items.Single(i => i.DocumentNumber == "BKK01-INV-2611-0002");
            using var pgCustomer2 = factory.CreateClient();
            pgCustomer2.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
            pgCustomer2.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.SecondaryCustomerId.ToString());
            Assert.Equal(HttpStatusCode.Forbidden, (await clientApp.PostAsJsonAsync(
                $"/api/v1/client/invoices/{pgInvoice2.Id}/slips", new SubmitPaymentSlipRequest(10m, "slips/pg.jpg"))).StatusCode);
            var pgSlip = await (await pgCustomer2.PostAsJsonAsync(
                $"/api/v1/client/invoices/{pgInvoice2.Id}/slips", new SubmitPaymentSlipRequest(1200m, "slips/pg.jpg", "BBL-1")))
                .Content.ReadFromJsonAsync<ClientPaymentSlipDto>();

            var approveRes = await cashierClient.PostAsync($"{bkkUrl}/payments/slips/{pgSlip!.Id}/approve", null);
            Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);
            var approvedSlip = await approveRes.Content.ReadFromJsonAsync<AdminPaymentSlipDto>();
            Assert.Equal("Paid", approvedSlip!.InvoiceStatus);
            Assert.StartsWith("BKK01-RCT-", approvedSlip.ReceiptDocumentNumber, StringComparison.Ordinal);
            Assert.Equal(HttpStatusCode.BadRequest, (await cashierClient.PostAsync($"{bkkUrl}/payments/slips/{pgSlip.Id}/approve", null)).StatusCode);

            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
                Assert.Equal(1, await db.Receipts.CountAsync(r => r.PaymentSlipId == pgSlip.Id));
            }

            var pgLedgers = await cashierClient.GetFromJsonAsync<DepositLedgerListResponse>($"{bkkUrl}/deposit-ledgers?type=LeaseSecurityDeposit");
            var settledLedger = Assert.Single(pgLedgers!.Items);
            Assert.Equal(createdLease.DocumentNumber, settledLedger.OwnerDocumentNumber);
            Assert.Equal(0m, settledLedger.CurrentBalance);
            Assert.Equal(3, settledLedger.Transactions.Count);
        }
        finally
        {
            await DropDatabaseQuietlyAsync(testDbName);
        }
    }

    private static async Task<bool> IsLocalPostgresAvailableAsync()
    {
        try
        {
            await using var conn = new NpgsqlConnection(AdminConnectionString);
            await conn.OpenAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async Task DropDatabaseQuietlyAsync(string dbName)
    {
        try
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(AdminConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE);";
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Ignore cleanup failure
        }
    }
}
