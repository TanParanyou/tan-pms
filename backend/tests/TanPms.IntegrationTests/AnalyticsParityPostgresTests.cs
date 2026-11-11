using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TanPms.Application.Analytics;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Leases;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

// The EF store aggregates analytics in SQL while the in-memory store uses AnalyticsCalculator; on identical seeded data
// plus identical operations every report must serialize to the same JSON.
public sealed class AnalyticsParityPostgresTests
{
    private const string AdminConnectionString =
        "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres;Timeout=2";

    [Fact]
    public async Task Ef_Aggregated_Analytics_Should_Match_InMemory_Calculator()
    {
        try
        {
            await using var probe = new NpgsqlConnection(AdminConnectionString);
            await probe.OpenAsync();
        }
        catch (NpgsqlException)
        {
            return;
        }

        var dbName = $"tan_pms_parity_{Guid.NewGuid():N}";
        try
        {
            await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("Auth:Mode", "Headers");
                builder.UseSetting("Auth:Jwt:SigningKey", InMemoryWebApiFactory.TestSigningKey);
                builder.UseSetting("Persistence:Provider", "Postgres");
                builder.UseSetting("ConnectionStrings:DefaultConnection", $"Host=localhost;Port=5432;Database={dbName};Username=postgres;Password=postgres");
            });

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
            await db.Database.MigrateAsync();
            await PmsDatabaseInitializer.SeedIfEmptyAsync(db, scope.ServiceProvider.GetRequiredService<IDocumentNumberService>());
            var ef = scope.ServiceProvider.GetRequiredService<EfCorePmsStore>();
            var memory = new InMemoryOperationalService();

            // Same operations on both stores: a cash shift, a lease with a cash deposit and a short close.
            foreach (var store in new IPmsOperationalStore[] { ef, memory })
            {
                var shift = store.OpenAdminCashierShift(PmsSeedConstants.BkkPropertyId, "pimchanok.bkk", new OpenCashierShiftRequest(1000m)).Value!;
                Assert.True(store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, new CreateLeaseRequest(
                    PmsSeedConstants.DirtyUnitA102Id, PmsSeedConstants.SecondaryCustomerId, new DateOnly(2027, 1, 1), new DateOnly(2027, 12, 31),
                    6000m, 12000m, 0m, 0m), cashierUserId: "pimchanok.bkk").IsSuccess);
                Assert.True(store.CloseAdminCashierShift(PmsSeedConstants.BkkPropertyId, shift.Id, "pimchanok.bkk", new CloseCashierShiftRequest(12990m, "Short 10")).IsSuccess);
            }

            var bkk = PmsSeedConstants.BkkPropertyId;
            var october = (new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31));
            var today = AnalyticsPeriod.Today();
            var jsonOptions = new JsonSerializerOptions { Converters = { new NormalizedDecimalConverter() } };
            string Json(object? value) => JsonSerializer.Serialize(value, jsonOptions);
            // The two seeds label Building A slightly differently; compare everything except that display name.
            static OccupancyReportDto Unlabelled(OccupancyReportDto r) =>
                r with { ByBuilding = r.ByBuilding.Select(b => b with { BuildingName = new Application.Common.Contracts.LocalizedTextDto("-") }).ToList() };
            Assert.Equal(
                Json(Unlabelled(memory.GetOccupancyReport(bkk, october.Item1, october.Item2).Value!)),
                Json(Unlabelled(ef.GetOccupancyReport(bkk, october.Item1, october.Item2).Value!)));
            Assert.Equal(Json(memory.GetRevParReport(bkk, october.Item1, october.Item2).Value), Json(ef.GetRevParReport(bkk, october.Item1, october.Item2).Value));
            Assert.Equal(Json(memory.GetAgingReport(bkk, today.AddDays(10)).Value), Json(ef.GetAgingReport(bkk, today.AddDays(10)).Value));
            Assert.Equal(Json(memory.GetAgingReport(bkk, today.AddDays(45)).Value), Json(ef.GetAgingReport(bkk, today.AddDays(45)).Value));
            Assert.Equal(Json(memory.GetCashierShiftSummary(bkk, today.AddDays(-29), today).Value), Json(ef.GetCashierShiftSummary(bkk, today.AddDays(-29), today).Value));
            Assert.Equal(Json(memory.GetDepositSummary(bkk, today.AddDays(-29), today).Value), Json(ef.GetDepositSummary(bkk, today.AddDays(-29), today).Value));
            Assert.Equal(-10m, ef.GetCashierShiftSummary(bkk, today.AddDays(-29), today).Value!.VarianceTotal);
            Assert.Equal(12000m, ef.GetDepositSummary(bkk, today.AddDays(-29), today).Value!.TotalHeldBalance);
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(AdminConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE);";
            await cmd.ExecuteNonQueryAsync();
        }
    }

    // PostgreSQL numeric(18,2) sums come back as 0.00 where LINQ-to-objects gives 0; compare values, not scale.
    private sealed class NormalizedDecimalConverter : System.Text.Json.Serialization.JsonConverter<decimal>
    {
        public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) => reader.GetDecimal();

        public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options) =>
            writer.WriteRawValue(value.ToString("0.############################", System.Globalization.CultureInfo.InvariantCulture));
    }
}
