using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
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
