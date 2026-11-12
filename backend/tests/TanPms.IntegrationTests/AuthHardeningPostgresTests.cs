using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TanPms.Application.Billing;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Identity;
using TanPms.Application.Meters;
using TanPms.Application.Rates;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

// Real PostgreSQL: atomic refresh rotation under concurrency, stale-token cleanup, and editable utility VAT.
public sealed class AuthHardeningPostgresTests
{
    private const string AdminConnectionString =
        "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres;Timeout=2";

    [Fact]
    public async Task Postgres_Refresh_Rotation_Cleanup_And_Utility_Vat_Change_Should_Work()
    {
        if (!await IsLocalPostgresAvailableAsync())
        {
            return;
        }

        var dbName = $"tan_pms_hard_{Guid.NewGuid():N}";
        try
        {
            await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("Auth:Mode", "Jwt");
                builder.UseSetting("Auth:Jwt:SigningKey", InMemoryWebApiFactory.TestSigningKey);
                builder.UseSetting("Auth:RateLimit:Enabled", "false");
                builder.UseSetting("Persistence:Provider", "Postgres");
                builder.UseSetting("ConnectionStrings:DefaultConnection", $"Host=localhost;Port=5432;Database={dbName};Username=postgres;Password=postgres");
            });

            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TanPmsDbContext>();
                await db.Database.MigrateAsync();
                await PmsDatabaseInitializer.SeedIfEmptyAsync(db, scope.ServiceProvider.GetRequiredService<IDocumentNumberService>());
            }

            await AssertConcurrentRotationAsync(factory.Services);
            AssertCleanup(factory.Services);
            AssertUtilityVatChange(factory.Services);
        }
        finally
        {
            await DropDatabaseAsync(dbName);
        }
    }

    // Each task uses its own scope/DbContext (as separate HTTP requests would); only one UPDATE ... WHERE RevokedAt IS NULL can win.
    private static async Task AssertConcurrentRotationAsync(IServiceProvider services)
    {
        var now = DateTimeOffset.UtcNow;
        using (var seed = services.CreateScope())
        {
            seed.ServiceProvider.GetRequiredService<IAuthStore>().AddRefreshToken(NewToken("race-old", now.AddDays(7)));
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 12).Select(i => Task.Run(() =>
        {
            using var scope = services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<IAuthStore>().TryRotateRefreshToken("race-old", $"race-new-{i}", now);
        })));

        Assert.Equal(1, results.Count(r => r));
        using var verify = services.CreateScope();
        var stored = verify.ServiceProvider.GetRequiredService<IAuthStore>().FindRefreshToken("race-old")!;
        Assert.NotNull(stored.RevokedAt);
        Assert.StartsWith("race-new-", stored.ReplacedByTokenHash, StringComparison.Ordinal);
    }

    private static void AssertCleanup(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IAuthStore>();
        var now = DateTimeOffset.UtcNow;
        store.AddRefreshToken(NewToken("clean-active", now.AddDays(5)));
        store.AddRefreshToken(NewToken("clean-expired-recent", now.AddDays(-5)));
        store.AddRefreshToken(NewToken("clean-expired-old", now.AddDays(-31)));
        store.AddRefreshToken(NewToken("clean-revoked-old", now.AddDays(5)));
        store.RevokeRefreshToken("clean-revoked-old", now.AddDays(-31));

        Assert.True(store.DeleteStaleRefreshTokens(now, TimeSpan.FromDays(30)) >= 2);
        Assert.Equal(0, store.DeleteStaleRefreshTokens(now, TimeSpan.FromDays(30)));
        Assert.NotNull(store.FindRefreshToken("clean-active"));
        Assert.NotNull(store.FindRefreshToken("clean-expired-recent"));
        Assert.Null(store.FindRefreshToken("clean-expired-old"));
        Assert.Null(store.FindRefreshToken("clean-revoked-old"));
    }

    private static void AssertUtilityVatChange(IServiceProvider services)
    {
        var bkk = PmsSeedConstants.BkkPropertyId;
        var a201 = PmsSeedConstants.OccupiedMonthlyUnitA201Id;
        using var scope = services.CreateScope();
        var rates = scope.ServiceProvider.GetRequiredService<IRateCatalogStore>();
        var meters = scope.ServiceProvider.GetRequiredService<IMeterReadingStore>();
        var billing = scope.ServiceProvider.GetRequiredService<IBillingStore>();

        Assert.True(meters.SaveAdminMeterReadings(bkk, new SaveMeterReadingsRequest("2026-10",
            [new MeterReadingInputDto(a201, 12m, 80m, false, false, null)]), false).Value!.IsSaved);
        var draft = billing.RunAdminBatchInvoices(bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Created.Single(i => i.Unit!.Id == a201);
        var water = draft.Lines[1];
        Assert.Equal("VatIncluded", water.TaxMode);
        var profile = rates.GetPropertyRateCatalog(bkk).Value!.TaxProfiles.Single(t => t.ChargeCategoryCode == "UTILITY_WATER");

        InvoiceItemDto Reprice(string mode, decimal rate)
        {
            Assert.True(rates.UpsertTaxProfile(bkk, new UpsertTaxProfileRequest(profile.Id, profile.ChargeCategoryCode, profile.Name, mode, rate, profile.DefaultWithholdingTaxPercent, profile.IsActive)).IsSuccess);
            return billing.RunAdminBatchInvoices(bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Refreshed.Single(i => i.Id == draft.Id);
        }

        var exempt = Reprice("Exempt", 0m);
        Assert.Equal(0m, exempt.Lines[1].VatAmount);
        var excluded = Reprice("VatExcluded", 7m);
        Assert.Equal(decimal.Round(water.LineAmount * 0.07m, 2, MidpointRounding.AwayFromZero), excluded.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount + excluded.Lines[1].VatAmount, excluded.Lines[1].NetAmount);
        var excluded10 = Reprice("VatExcluded", 10m);
        Assert.Equal(water.LineAmount, excluded10.Lines[1].SubTotal);
        Assert.Equal(decimal.Round(water.LineAmount * 0.10m, 2, MidpointRounding.AwayFromZero), excluded10.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount + excluded10.Lines[1].VatAmount, excluded10.Lines[1].NetAmount);
        var included10 = Reprice("VatIncluded", 10m);
        var expectedSub10 = decimal.Round(water.LineAmount / 1.10m, 2, MidpointRounding.AwayFromZero);
        Assert.Equal(expectedSub10, included10.Lines[1].SubTotal);
        Assert.Equal(water.LineAmount - expectedSub10, included10.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount, included10.Lines[1].NetAmount);
        var included = Reprice("VatIncluded", 7m);
        Assert.Equal(water.VatAmount, included.Lines[1].VatAmount);

        Assert.True(billing.IssueAdminInvoice(bkk, draft.Id).IsSuccess);
        var issued = billing.GetAdminInvoice(bkk, draft.Id).Value!;
        Assert.True(rates.UpsertTaxProfile(bkk, new UpsertTaxProfileRequest(profile.Id, profile.ChargeCategoryCode, profile.Name, "Exempt", 0m, profile.DefaultWithholdingTaxPercent, profile.IsActive)).IsSuccess);
        Assert.DoesNotContain(billing.RunAdminBatchInvoices(bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Refreshed, i => i.Id == draft.Id);
        var after = billing.GetAdminInvoice(bkk, draft.Id).Value!;
        Assert.Equal(issued.TotalAmount, after.TotalAmount);
        Assert.Equal(issued.TotalVatAmount, after.TotalVatAmount);
    }

    private static RefreshToken NewToken(string hash, DateTimeOffset expiresAt) => new()
    {
        TokenHash = hash,
        FamilyId = Guid.NewGuid(),
        SubjectId = Guid.NewGuid().ToString(),
        Scope = "admin",
        ExpiresAt = expiresAt
    };

    private static async Task<bool> IsLocalPostgresAvailableAsync()
    {
        try
        {
            await using var conn = new NpgsqlConnection(AdminConnectionString);
            await conn.OpenAsync();
            return true;
        }
        catch (NpgsqlException)
        {
            return false;
        }
        catch (TimeoutException)
        {
            return false;
        }
    }

    private static async Task DropDatabaseAsync(string dbName)
    {
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(AdminConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE)";
        await cmd.ExecuteNonQueryAsync();
    }
}
