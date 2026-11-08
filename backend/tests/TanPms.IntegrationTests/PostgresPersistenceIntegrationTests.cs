using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Customers;
using TanPms.Application.Housekeeping;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Parcels;
using TanPms.Application.Payments;
using TanPms.Application.Rack;
using TanPms.Application.Stays;
using TanPms.Application.WorkOrders;
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
                $"/api/v1/client/invoices/{pgInvoice2.Id}/slips", new SubmitPaymentSlipRequest(10m, await TestUploads.ClientAsync(clientApp, "PaymentSlip")))).StatusCode);
            var pgSlip = await (await pgCustomer2.PostAsJsonAsync(
                $"/api/v1/client/invoices/{pgInvoice2.Id}/slips", new SubmitPaymentSlipRequest(1200m, await TestUploads.ClientAsync(pgCustomer2, "PaymentSlip"), "BBL-1")))
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

            // 8. PM-09 housekeeping, work orders and parcels through EfCorePmsStore + PostgreSQL
            using var opsClient = factory.CreateClient();
            opsClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            opsClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            opsClient.DefaultRequestHeaders.Add(
                "X-TanPms-Permissions",
                string.Join(",", PermissionKeys.AdminHousekeepingUpdate, PermissionKeys.AdminWorkOrdersManage, PermissionKeys.AdminParcelsManage));

            // Step 4 checked out A-101 and step 5 moved out of A-102: both left Pending housekeeping tasks.
            var hkTasks = await opsClient.GetFromJsonAsync<HousekeepingTaskListResponse>($"{bkkUrl}/housekeeping/tasks?status=Pending");
            var a101Task = hkTasks!.Items.First(t => t.Unit.Id == PmsSeedConstants.CleanUnitA101Id);
            Assert.Equal("Cleaning", (await (await opsClient.PostAsync($"{bkkUrl}/housekeeping/tasks/{a101Task.Id}/start", null))
                .Content.ReadFromJsonAsync<HousekeepingTaskDto>())!.Status);
            var cleanTask = await (await opsClient.PostAsJsonAsync(
                $"{bkkUrl}/housekeeping/tasks/{a101Task.Id}/complete", new CompleteHousekeepingTaskRequest(SkipInspection: true)))
                .Content.ReadFromJsonAsync<HousekeepingTaskDto>();
            Assert.Equal("Completed", cleanTask!.Status);
            Assert.Equal("Clean", cleanTask.UnitConditionStatus);

            // Repair on the seeded A-201 lease is appended to a Draft invoice (the 2026-10 one from step 6 is Issued).
            var woCreated = await (await opsClient.PostAsJsonAsync(
                $"{bkkUrl}/work-orders", new CreateWorkOrderRequest(PmsSeedConstants.OccupiedMonthlyUnitA201Id, "Door hinge", null, "Urgent")))
                .Content.ReadFromJsonAsync<WorkOrderItemDto>();
            Assert.StartsWith("BKK01-WKO-", woCreated!.DocumentNumber, StringComparison.Ordinal);
            Assert.Equal(HttpStatusCode.OK, (await opsClient.PostAsJsonAsync(
                $"{bkkUrl}/work-orders/{woCreated.Id}/assign", new AssignWorkOrderRequest("tech-pg"))).StatusCode);
            var woResolved = await (await opsClient.PostAsJsonAsync(
                $"{bkkUrl}/work-orders/{woCreated.Id}/resolve", new ResolveWorkOrderRequest("Hinge replaced", await TestUploads.AdminAsync(opsClient, "WorkOrderPhoto", PmsSeedConstants.BkkPropertyId), 535m, true)))
                .Content.ReadFromJsonAsync<WorkOrderItemDto>();
            Assert.Equal("Completed", woResolved!.Status);
            var repairDrafts = await billingClient.GetFromJsonAsync<InvoiceListResponse>($"{bkkUrl}/invoices?status=Draft");
            var repairDraft = Assert.Single(repairDrafts!.Items, i => i.DocumentNumber == woResolved.ChargeDocumentNumber);
            Assert.Equal(535m, repairDraft.TotalAmount);

            var pgParcel = await (await opsClient.PostAsJsonAsync(
                $"{bkkUrl}/parcels", new ReceiveParcelRequest(PmsSeedConstants.OccupiedMonthlyUnitA201Id, "Kerry", "KEX-PG")))
                .Content.ReadFromJsonAsync<ParcelItemDto>();
            Assert.Equal(PmsSeedConstants.PrimaryCustomerId, pgParcel!.Customer.Id);
            Assert.NotEqual("BKK01-PCL-2611-0001", pgParcel.DocumentNumber);
            var pgClientParcels = await clientApp.GetFromJsonAsync<ParcelListResponse>("/api/v1/client/parcels?status=Arrived");
            Assert.Contains(pgClientParcels!.Items, p => p.Id == pgParcel.Id);
            var pickedUp = await (await opsClient.PostAsJsonAsync(
                $"{bkkUrl}/parcels/{pgParcel.Id}/pickup", new PickUpParcelRequest("Somchai")))
                .Content.ReadFromJsonAsync<ParcelItemDto>();
            Assert.Equal("PickedUp", pickedUp!.Status);

            // 9. Edit / delete / cancel / void flows through EfCorePmsStore + PostgreSQL
            using var crudClient = factory.CreateClient();
            crudClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            crudClient.DefaultRequestHeaders.Add("X-TanPms-User-Id", "pg-crud");
            crudClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            crudClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", string.Join(",",
                PermissionKeys.AdminLeasesManage,
                PermissionKeys.AdminLeasesSettleMoveOut,
                PermissionKeys.AdminMetersRecord,
                PermissionKeys.AdminBillingIssueBatch,
                PermissionKeys.AdminInvoicesVoid,
                PermissionKeys.AdminCashierOperateShift,
                PermissionKeys.AdminHousekeepingUpdate,
                PermissionKeys.AdminWorkOrdersManage,
                PermissionKeys.AdminParcelsManage));

            var crudLease = await (await crudClient.PostAsJsonAsync(leasesUrl, new CreateLeaseRequest(
                PmsSeedConstants.DirtyUnitA102Id,
                PmsSeedConstants.SecondaryCustomerId,
                new DateOnly(2026, 12, 10),
                new DateOnly(2027, 12, 9),
                6500m,
                9000m,
                0m,
                0m,
                [new LeaseOccupantRequest("Main Tenant", "THA", "3100500000033", true), new LeaseOccupantRequest("Room Mate", "THA", "3100500000044", false)],
                [new LeaseVehicleRequest("3กข 5555", "Bangkok", "Toyota")]))).Content.ReadFromJsonAsync<LeaseItemDto>();
            var mate = crudLease!.Occupants.Single(o => !o.IsPrimaryOccupant);
            var promotedLease = await (await crudClient.PutAsJsonAsync(
                $"{leasesUrl}/{crudLease.Id}/occupants/{mate.Id}", new UpdateLeaseOccupantRequest("Room Mate", "THA", null, true)))
                .Content.ReadFromJsonAsync<LeaseItemDto>();
            Assert.True(promotedLease!.Occupants.Single(o => o.Id == mate.Id).IsPrimaryOccupant);
            var oldPrimary = promotedLease.Occupants.Single(o => o.Id != mate.Id);
            Assert.Single((await (await crudClient.DeleteAsync($"{leasesUrl}/{crudLease.Id}/occupants/{oldPrimary.Id}"))
                .Content.ReadFromJsonAsync<LeaseItemDto>())!.Occupants);
            Assert.Equal(HttpStatusCode.BadRequest, (await crudClient.DeleteAsync($"{leasesUrl}/{crudLease.Id}/occupants/{mate.Id}")).StatusCode);
            var vehicleId = crudLease.Vehicles.Single().Id;
            Assert.Equal(HttpStatusCode.OK, (await crudClient.PutAsJsonAsync(
                $"{leasesUrl}/{crudLease.Id}/vehicles/{vehicleId}", new LeaseVehicleRequest("3กข 5556", "Bangkok", "Toyota"))).StatusCode);
            Assert.Empty((await (await crudClient.DeleteAsync($"{leasesUrl}/{crudLease.Id}/vehicles/{vehicleId}"))
                .Content.ReadFromJsonAsync<LeaseItemDto>())!.Vehicles);
            Assert.Equal(7000m, (await (await crudClient.PutAsJsonAsync(
                $"{leasesUrl}/{crudLease.Id}", new UpdateLeaseRequest(7000m, null, null, "Rent agreed before move-in")))
                .Content.ReadFromJsonAsync<LeaseItemDto>())!.MonthlyRentAmount);

            Assert.True((await (await crudClient.PutAsJsonAsync($"{bkkUrl}/meter-readings", new SaveMeterReadingsRequest(
                "2026-12", [new MeterReadingInputDto(PmsSeedConstants.DirtyUnitA102Id, 10m, 20m)])))
                .Content.ReadFromJsonAsync<SaveMeterReadingsResponse>())!.IsSaved);
            var decRun = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs", new BatchInvoiceRunRequest("2026-12")))
                .Content.ReadFromJsonAsync<BatchInvoiceRunResponse>();
            var decDraft = Assert.Single(decRun!.Created);
            Assert.Equal(4967.74m, decDraft.Lines[0].LineAmount); // 7000 x 22 / 31 days

            Assert.True((await (await crudClient.PutAsJsonAsync($"{bkkUrl}/meter-readings", new SaveMeterReadingsRequest(
                "2026-12", [new MeterReadingInputDto(PmsSeedConstants.DirtyUnitA102Id, 10m, 40m)])))
                .Content.ReadFromJsonAsync<SaveMeterReadingsResponse>())!.IsSaved);
            var decRerun = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs", new BatchInvoiceRunRequest("2026-12")))
                .Content.ReadFromJsonAsync<BatchInvoiceRunResponse>();
            var refreshedDraft = Assert.Single(decRerun!.Refreshed);
            Assert.Equal(decDraft.Id, refreshedDraft.Id);
            Assert.Equal(320m, refreshedDraft.Lines.Single(l => l.Description.En!.StartsWith("Electricity", StringComparison.Ordinal)).LineAmount); // 40 kWh x 8
            Assert.Empty((await (await crudClient.PostAsJsonAsync($"{bkkUrl}/billing/batch-invoice-runs", new BatchInvoiceRunRequest("2026-12")))
                .Content.ReadFromJsonAsync<BatchInvoiceRunResponse>())!.Refreshed);

            var parkingLine = new InvoiceLineRequest(new LocalizedTextDto("ค่าที่จอดรถ", "Parking"), 500m, "VatIncluded");
            var withParking = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/invoices/{decDraft.Id}/lines", parkingLine))
                .Content.ReadFromJsonAsync<InvoiceItemDto>();
            Assert.Equal(4, withParking!.Lines.Count);
            // Line order from PostgreSQL is not guaranteed, so lines are located by description.
            var parkingId = withParking.Lines.Single(l => l.Description.En == "Parking").Id;
            var repriced = await (await crudClient.PutAsJsonAsync(
                $"{bkkUrl}/invoices/{decDraft.Id}/lines/{parkingId}", parkingLine with { LineAmount = 650m }))
                .Content.ReadFromJsonAsync<InvoiceItemDto>();
            var repricedParking = repriced!.Lines.Single(l => l.Description.En == "Parking");
            Assert.Equal(650m, repricedParking.LineAmount);
            Assert.Equal(3, (await (await crudClient.DeleteAsync($"{bkkUrl}/invoices/{decDraft.Id}/lines/{repricedParking.Id}"))
                .Content.ReadFromJsonAsync<InvoiceItemDto>())!.Lines.Count);
            Assert.Equal(3, (await crudClient.GetFromJsonAsync<InvoiceItemDto>($"{bkkUrl}/invoices/{decDraft.Id}"))!.Lines.Count);

            var deletedRow = await (await crudClient.DeleteAsync(
                $"{bkkUrl}/meter-readings/units/{PmsSeedConstants.DirtyUnitA102Id}?period=2026-12"))
                .Content.ReadFromJsonAsync<MeterReadingSheetRowDto>();
            Assert.Null(deletedRow!.Electric.CurrentReading);

            // Only a Draft invoice exists, so cancel is allowed: full deposit refund and the draft is soft-deleted.
            var cancelledLease = await (await crudClient.PostAsJsonAsync(
                $"{leasesUrl}/{crudLease.Id}/cancel", new ReasonRequest("Tenant withdrew before move-in")))
                .Content.ReadFromJsonAsync<LeaseSettlementDto>();
            Assert.Equal("Cancelled", cancelledLease!.Lease.Status);
            Assert.Equal(9000m, cancelledLease.RefundedAmount);
            Assert.Equal(HttpStatusCode.BadRequest, (await crudClient.GetAsync($"{bkkUrl}/invoices/{decDraft.Id}")).StatusCode);

            var crudShift = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/cashier/shifts/open", new OpenCashierShiftRequest(200m)))
                .Content.ReadFromJsonAsync<CashierShiftDto>();
            Assert.Equal(HttpStatusCode.BadRequest, (await crudClient.PostAsJsonAsync(
                $"{bkkUrl}/cashier/shifts/{crudShift!.Id}/cancel", new ReasonRequest(""))).StatusCode);
            Assert.Equal("Cancelled", (await (await crudClient.PostAsJsonAsync(
                $"{bkkUrl}/cashier/shifts/{crudShift.Id}/cancel", new ReasonRequest("Opened by mistake")))
                .Content.ReadFromJsonAsync<CashierShiftDto>())!.Status);
            Assert.Equal(HttpStatusCode.Created, (await crudClient.PostAsJsonAsync($"{bkkUrl}/cashier/shifts/open", new OpenCashierShiftRequest(200m))).StatusCode);
            Assert.Equal("Cancelled", (await crudClient.GetFromJsonAsync<CashierShiftDto>($"{bkkUrl}/cashier/shifts/{crudShift.Id}"))!.Status);

            var manualTask = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/housekeeping/tasks",
                new CreateHousekeepingTaskRequest(PmsSeedConstants.CleanUnitA101Id, "Spot clean carpet")))
                .Content.ReadFromJsonAsync<HousekeepingTaskDto>();
            Assert.Equal("Bring vacuum", (await (await crudClient.PutAsJsonAsync($"{bkkUrl}/housekeeping/tasks/{manualTask!.Id}",
                new UpdateHousekeepingTaskRequest("maid-pg", "Bring vacuum"))).Content.ReadFromJsonAsync<HousekeepingTaskDto>())!.Note);
            Assert.Equal(HttpStatusCode.OK, (await crudClient.DeleteAsync($"{bkkUrl}/housekeeping/tasks/{manualTask.Id}")).StatusCode);

            var crudWo = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/work-orders",
                new CreateWorkOrderRequest(PmsSeedConstants.OccupiedMonthlyUnitA201Id, "Aircon noise")))
                .Content.ReadFromJsonAsync<WorkOrderItemDto>();
            Assert.Equal("High", (await (await crudClient.PutAsJsonAsync($"{bkkUrl}/work-orders/{crudWo!.Id}",
                new UpdateWorkOrderRequest("Aircon rattling", null, "High"))).Content.ReadFromJsonAsync<WorkOrderItemDto>())!.Priority);
            var cancelledWo = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/work-orders/{crudWo.Id}/cancel", new ReasonRequest("Duplicate")))
                .Content.ReadFromJsonAsync<WorkOrderItemDto>();
            Assert.Equal("Cancelled", cancelledWo!.Status);
            Assert.Equal("Duplicate", (await crudClient.GetFromJsonAsync<WorkOrderItemDto>($"{bkkUrl}/work-orders/{crudWo.Id}"))!.CancelReason);

            var crudParcel = await (await crudClient.PostAsJsonAsync($"{bkkUrl}/parcels",
                new ReceiveParcelRequest(PmsSeedConstants.OccupiedMonthlyUnitA201Id, "Thai Post")))
                .Content.ReadFromJsonAsync<ParcelItemDto>();
            Assert.Equal("EMS-1", (await (await crudClient.PutAsJsonAsync($"{bkkUrl}/parcels/{crudParcel!.Id}",
                new ReceiveParcelRequest(PmsSeedConstants.OccupiedMonthlyUnitA201Id, "Thai Post EMS", "EMS-1")))
                .Content.ReadFromJsonAsync<ParcelItemDto>())!.TrackingNumber);
            Assert.Equal(HttpStatusCode.OK, (await clientApp.GetAsync($"/api/v1/client/parcels/{crudParcel.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await crudClient.PostAsJsonAsync($"{bkkUrl}/parcels/{crudParcel.Id}/void", new ReasonRequest("Logged twice"))).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await crudClient.GetAsync($"{bkkUrl}/parcels/{crudParcel.Id}")).StatusCode);

            // Client edits then withdraws its own Pending slip; another customer gets 403; then the unpaid invoice is voided.
            var seededInvoice = (await billingClient.GetFromJsonAsync<InvoiceListResponse>($"{bkkUrl}/invoices?period=2026-11"))!.Items.Single();
            var pendingSlip = await (await clientApp.PostAsJsonAsync(
                $"/api/v1/client/invoices/{seededInvoice.Id}/slips", new SubmitPaymentSlipRequest(100m, await TestUploads.ClientAsync(clientApp, "PaymentSlip"))))
                .Content.ReadFromJsonAsync<ClientPaymentSlipDto>();
            Assert.Equal(200m, (await (await clientApp.PutAsJsonAsync(
                $"/api/v1/client/invoices/{seededInvoice.Id}/slips/{pendingSlip!.Id}", new SubmitPaymentSlipRequest(200m, await TestUploads.ClientAsync(clientApp, "PaymentSlip"))))
                .Content.ReadFromJsonAsync<ClientPaymentSlipDto>())!.Amount);
            Assert.Equal(HttpStatusCode.Forbidden, (await pgCustomer2.DeleteAsync($"/api/v1/client/invoices/{seededInvoice.Id}/slips/{pendingSlip.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await crudClient.PostAsJsonAsync($"{bkkUrl}/invoices/{seededInvoice.Id}/void", new ReasonRequest("x"))).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await clientApp.DeleteAsync($"/api/v1/client/invoices/{seededInvoice.Id}/slips/{pendingSlip.Id}")).StatusCode);
            var voidedInvoice = await (await crudClient.PostAsJsonAsync(
                $"{bkkUrl}/invoices/{seededInvoice.Id}/void", new ReasonRequest("Re-billed under corrected lease")))
                .Content.ReadFromJsonAsync<InvoiceItemDto>();
            Assert.Equal("Voided", voidedInvoice!.Status);

            // 10. Round B1: reasons, user names, files, PDFs, cash-to-shift binding and seed self-healing on PostgreSQL
            Assert.Equal("Tenant withdrew before move-in", (await crudClient.GetFromJsonAsync<LeaseItemDto>($"{leasesUrl}/{crudLease.Id}"))!.CancelReason);
            Assert.Equal("Opened by mistake", (await crudClient.GetFromJsonAsync<CashierShiftDto>($"{bkkUrl}/cashier/shifts/{crudShift.Id}"))!.CancelReason);
            Assert.Equal("Re-billed under corrected lease", voidedInvoice.VoidReason);
            Assert.Equal("tech-pg", woResolved.AssignedTechnician!.Id);
            Assert.Equal("pg-cashier", approvedSlip.ReviewedBy!.Id);
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
                var voidedParcel = await db.Parcels.IgnoreQueryFilters().AsNoTracking().SingleAsync(p => p.Id == crudParcel.Id);
                Assert.True(voidedParcel.IsDeleted);
                Assert.Equal("Logged twice", voidedParcel.VoidReason);
            }

            // Files: magic-byte validation, purpose rules, authorized download and traversal-proof keys.
            var parcelPhoto = await TestUploads.AdminAsync(crudClient, "ParcelPhoto", PmsSeedConstants.BkkPropertyId);
            Assert.Equal(HttpStatusCode.BadRequest, (await TestUploads.PostAsync(
                crudClient, "/api/v1/admin/files", "ParcelPhoto", PmsSeedConstants.BkkPropertyId, "not an image"u8.ToArray())).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await TestUploads.PostAsync(clientApp, "/api/v1/client/files", "MeterPhoto")).StatusCode);
            Assert.Equal(TestUploads.Png, await crudClient.GetByteArrayAsync($"/api/v1/admin/files/{parcelPhoto}"));
            using var cnxAdmin = factory.CreateClient();
            cnxAdmin.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            cnxAdmin.DefaultRequestHeaders.Add("X-TanPms-User-Id", "cnx-admin");
            cnxAdmin.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.CnxPropertyId.ToString());
            Assert.Equal(HttpStatusCode.Forbidden, (await cnxAdmin.GetAsync($"/api/v1/admin/files/{parcelPhoto}")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await clientApp.GetAsync($"/api/v1/client/files/{parcelPhoto}")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await crudClient.GetAsync("/api/v1/admin/files/..%2F..%2Fappsettings.json")).StatusCode);
            Assert.Equal(HttpStatusCode.Created, (await crudClient.PostAsJsonAsync($"{bkkUrl}/parcels",
                new ReceiveParcelRequest(PmsSeedConstants.OccupiedMonthlyUnitA201Id, "J&T", null, parcelPhoto))).StatusCode);
            // Attached to the tenant's own parcel, so the tenant may now download it.
            Assert.Equal(HttpStatusCode.OK, (await clientApp.GetAsync($"/api/v1/client/files/{parcelPhoto}")).StatusCode);

            // Receipts + PDFs (Sarabun-embedded QuestPDF output).
            var receiptList = await cashierClient.GetFromJsonAsync<ReceiptListResponse>($"{bkkUrl}/receipts?invoiceId={pgInvoice2.Id}");
            var pgReceipt = Assert.Single(receiptList!.Items);
            var receiptPdf = await cashierClient.GetAsync($"{bkkUrl}/receipts/{pgReceipt.Id}/pdf");
            Assert.Equal("application/pdf", receiptPdf.Content.Headers.ContentType!.MediaType);
            Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString((await receiptPdf.Content.ReadAsByteArrayAsync())[..4]), StringComparison.Ordinal);
            Assert.Contains((await pgCustomer2.GetFromJsonAsync<ReceiptListResponse>("/api/v1/client/receipts"))!.Items, r => r.Id == pgReceipt.Id);
            Assert.Equal(HttpStatusCode.OK, (await pgCustomer2.GetAsync($"/api/v1/client/receipts/{pgReceipt.Id}/pdf")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await clientApp.GetAsync($"/api/v1/client/receipts/{pgReceipt.Id}/pdf")).StatusCode);
            var contractPdf = await crudClient.GetByteArrayAsync($"{leasesUrl}/{crudLease.Id}/contract.pdf");
            Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(contractPdf[..4]), StringComparison.Ordinal);
            Assert.Equal(HttpStatusCode.Forbidden, (await billingClient.GetAsync($"{leasesUrl}/{crudLease.Id}/contract.pdf")).StatusCode);

            // Cash binding: key deposit, cash folio payment and deposit refund land on the caller's Open shift in this property.
            using var cashClient = factory.CreateClient();
            cashClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            cashClient.DefaultRequestHeaders.Add("X-TanPms-User-Id", "pimchanok.bkk");
            cashClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", $"{PmsSeedConstants.BkkPropertyId},{PmsSeedConstants.CnxPropertyId}");
            cashClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", string.Join(",",
                PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut, PermissionKeys.AdminCashierOperateShift));
            var cashCheckIn = new CheckInStayRequest(
                PmsSeedConstants.BkkPropertyId, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 300m,
                InitialRoomChargeAmount: 500m);
            // A shift open in another property does not count (property-scoped check).
            Assert.Equal(HttpStatusCode.Created, (await cashClient.PostAsJsonAsync(
                $"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/cashier/shifts/open", new OpenCashierShiftRequest(0m))).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await cashClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", cashCheckIn)).StatusCode);
            var cashShift = await (await cashClient.PostAsJsonAsync($"{bkkUrl}/cashier/shifts/open", new OpenCashierShiftRequest(1000m)))
                .Content.ReadFromJsonAsync<CashierShiftDto>();
            Assert.Equal("Pimchanok Srisawat", cashShift!.Cashier.FullName);
            var cashStay = await (await cashClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", cashCheckIn))
                .Content.ReadFromJsonAsync<StaySummaryDto>();
            Assert.Equal(HttpStatusCode.OK, (await cashClient.PostAsJsonAsync(
                $"{bkkUrl}/stays/{cashStay!.Id}/folio/payments", new RecordFolioPaymentRequest(500m, "Cash"))).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await cashClient.PostAsJsonAsync(
                $"{bkkUrl}/stays/{cashStay.Id}/check-out", new CheckOutStayRequest(0m, "Key returned"))).StatusCode);
            var boundShift = await cashClient.GetFromJsonAsync<CashierShiftDto>($"{bkkUrl}/cashier/shifts/{cashShift.Id}");
            Assert.Equal(500m, boundShift!.CashReceiptsInShift);
            Assert.Equal(300m, boundShift.CashDepositsReceivedInShift);
            Assert.Equal(300m, boundShift.CashDepositsRefundedInShift);

            // Seed self-healing: remove utility tax profiles and rewind a sequence, then re-run the idempotent upgrade.
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
                await db.Database.ExecuteSqlRawAsync("DELETE FROM \"TaxProfiles\" WHERE \"ChargeCategoryCode\" IN ('UTILITY_WATER', 'UTILITY_ELECTRIC')");
                await db.Database.ExecuteSqlRawAsync("UPDATE document_sequences SET last_sequence = 0 WHERE document_type = 'INV'");
                await PmsDatabaseInitializer.ApplySeedUpgradesAsync(db);
                await PmsDatabaseInitializer.ApplySeedUpgradesAsync(db);
                Assert.Equal(2, await db.TaxProfiles.CountAsync(p =>
                    p.PropertyId == PmsSeedConstants.BkkPropertyId && (p.ChargeCategoryCode == "UTILITY_WATER" || p.ChargeCategoryCode == "UTILITY_ELECTRIC")));
                var docService = scope.ServiceProvider.GetRequiredService<IDocumentNumberService>();
                var existingInvoiceNumbers = await db.Invoices.IgnoreQueryFilters().Select(i => i.DocumentNumber).ToListAsync();
                var nextInvoiceNumber = await docService.NextDocumentNumberAsync(
                    PmsSeedConstants.BkkPropertyId, "BKK01", DocumentTypeCode.INV, new DateTimeOffset(2026, 11, 8, 0, 0, 0, TimeSpan.Zero));
                Assert.DoesNotContain(nextInvoiceNumber, existingInvoiceNumbers);
            }

            // 11. PM-10 client self-service + executive analytics through EfCorePmsStore + PostgreSQL
            var a201Lease = (await clientApp.GetFromJsonAsync<LeaseListResponse>("/api/v1/client/leases"))!.Items
                .Single(l => l.Unit.Id == PmsSeedConstants.OccupiedMonthlyUnitA201Id);
            Assert.Equal(HttpStatusCode.Forbidden, (await pgCustomer2.GetAsync($"/api/v1/client/leases/{a201Lease.Id}")).StatusCode);
            var clientInvoices = (await clientApp.GetFromJsonAsync<ClientInvoiceListResponse>("/api/v1/client/invoices"))!.Items;
            Assert.DoesNotContain(clientInvoices, i => i.Invoice.Status == "Draft");
            Assert.Contains(clientInvoices, i => i.Invoice.Status == "Voided" && i.Invoice.VoidReason == "Re-billed under corrected lease");
            var octInvoice = clientInvoices.Single(i => i.Invoice.BillingPeriodYearMonth == "2026-10");
            Assert.Equal(octInvoice.Invoice.TotalAmount, octInvoice.OutstandingAmount);
            Assert.Equal(HttpStatusCode.Forbidden, (await pgCustomer2.GetAsync($"/api/v1/client/invoices/{octInvoice.Invoice.Id}")).StatusCode);
            var usage = await clientApp.GetFromJsonAsync<Application.Meters.ClientUtilityUsageResponse>($"/api/v1/client/utility-usage?leaseId={a201Lease.Id}");
            Assert.Contains(usage!.Months, m => m.Period == "2026-10" && m.WaterUsageUnits == 25m);

            var pgIntent = await (await clientApp.PostAsJsonAsync(
                $"/api/v1/client/leases/{a201Lease.Id}/intents", new CreateLeaseIntentRequest("Renew", new DateOnly(2027, 6, 30), "Stay longer")))
                .Content.ReadFromJsonAsync<LeaseIntentDto>();
            Assert.Equal(HttpStatusCode.Forbidden, (await pgCustomer2.DeleteAsync($"/api/v1/client/lease-intents/{pgIntent!.Id}")).StatusCode);
            Assert.Equal("Approved", (await (await crudClient.PostAsync($"{bkkUrl}/lease-intents/{pgIntent.Id}/approve", null))
                .Content.ReadFromJsonAsync<LeaseIntentDto>())!.Status);
            Assert.Equal(new DateOnly(2027, 6, 30), (await clientApp.GetFromJsonAsync<LeaseItemDto>($"/api/v1/client/leases/{a201Lease.Id}"))!.EndDate);
            Assert.Contains((await clientApp.GetFromJsonAsync<NotificationListResponse>("/api/v1/client/notifications"))!.Items,
                n => n.TemplateKey == LeaseIntentRules.ApprovedTemplateKey);

            using var analyticsClient = factory.CreateClient();
            analyticsClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
            analyticsClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
            analyticsClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminAnalyticsRead);
            // October: A-201 lease 31 nights + seeded A-102 daily stay 2 nights over 3 units x 31 nights.
            var pgOccupancy = await analyticsClient.GetFromJsonAsync<OccupancyReportDto>($"{bkkUrl}/analytics/occupancy?from=2026-10-01&to=2026-10-31");
            Assert.Equal(93, pgOccupancy!.AvailableUnitNights);
            Assert.Equal(33, pgOccupancy.OccupiedUnitNights);
            Assert.Equal(0.3548m, pgOccupancy.OccupancyRate);
            // Folio 2,242.99 ex-VAT + issued October rent 8,500 = 10,742.99 / 93 = 115.52.
            var pgRevPar = await analyticsClient.GetFromJsonAsync<RevParReportDto>($"{bkkUrl}/analytics/revpar?from=2026-10-01&to=2026-10-31");
            Assert.Equal(2242.99m, pgRevPar!.FolioRoomRevenue);
            Assert.Equal(8500m, pgRevPar.LeaseRentRevenue);
            Assert.Equal(115.52m, pgRevPar.RevPar);
            var pgAging = await analyticsClient.GetFromJsonAsync<AgingReportDto>($"{bkkUrl}/analytics/receivables-aging");
            Assert.Contains(pgAging!.Customers, c => c.Customer.Id == PmsSeedConstants.PrimaryCustomerId && c.Buckets.Total >= octInvoice.OutstandingAmount);
            var pgShifts = await analyticsClient.GetFromJsonAsync<CashierShiftSummaryDto>($"{bkkUrl}/analytics/cashier-shifts");
            Assert.Contains(pgShifts!.Cashiers, c => c.Cashier.FullName == "Pimchanok Srisawat");
            Assert.Equal(-10m, pgShifts.VarianceTotal); // only the step-7 shift closed short by 10
            var pgDeposits = await analyticsClient.GetFromJsonAsync<DepositSummaryDto>($"{bkkUrl}/analytics/deposits");
            Assert.Equal("Liability", pgDeposits!.Classification);
            Assert.Equal(pgDeposits.ByType.Sum(t => t.HeldBalance), pgDeposits.TotalHeldBalance);
            Assert.Equal(HttpStatusCode.Forbidden, (await cnxAdmin.GetAsync($"{bkkUrl}/analytics/occupancy")).StatusCode);
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
