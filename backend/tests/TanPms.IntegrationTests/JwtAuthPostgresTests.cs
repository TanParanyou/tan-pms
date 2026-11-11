using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Identity;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

// EF Core path of the JWT flow: credentials, lockout columns and refresh-token rotation persisted in PostgreSQL.
public sealed class JwtAuthPostgresTests
{
    private const string AdminConnectionString =
        "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres;Timeout=2";

    [Fact]
    public async Task Postgres_Jwt_Login_Refresh_Reuse_ChangePassword_And_Customer_Account_Should_Persist()
    {
        if (!await IsLocalPostgresAvailableAsync())
        {
            return;
        }

        var dbName = $"tan_pms_auth_{Guid.NewGuid():N}";
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
                var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
                await PmsDatabaseInitializer.SeedDevCredentialsAsync(db, hasher, InMemoryWebApiFactory.DevPassword);
                await PmsDatabaseInitializer.SeedDevCredentialsAsync(db, hasher, InMemoryWebApiFactory.DevPassword);
                Assert.Equal(PmsSeedConstants.DevCustomerLogins.Count, await db.CustomerAccounts.CountAsync());
                Assert.DoesNotContain(await db.AdminUsers.AsNoTracking().ToListAsync(), u => u.PasswordHash == null);
            }

            using var client = factory.CreateClient();
            var wrong = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "kittisak.cnx", "wrong-password-1"));
            Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);

            var session = await LoginAsync(client, "admin", "kittisak.cnx", InMemoryWebApiFactory.DevPassword);
            Assert.Equal(HttpStatusCode.OK, (await GetAsync(client, "/api/v1/auth/me", session.AccessToken)).StatusCode);

            var rotatedRes = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(session.RefreshToken!));
            Assert.Equal(HttpStatusCode.OK, rotatedRes.StatusCode);
            var rotated = (await rotatedRes.Content.ReadFromJsonAsync<AuthSessionResponse>())!;
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(session.RefreshToken!))).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(rotated.RefreshToken!))).StatusCode);

            var fresh = await LoginAsync(client, "admin", "kittisak.cnx", InMemoryWebApiFactory.DevPassword);
            using (var change = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/change-password")
            {
                Content = JsonContent.Create(new ChangePasswordRequest(InMemoryWebApiFactory.DevPassword, "kittisak-new-pass"))
            })
            {
                change.Headers.Authorization = new AuthenticationHeaderValue("Bearer", fresh.AccessToken);
                Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(change)).StatusCode);
            }

            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(fresh.RefreshToken!))).StatusCode);
            await LoginAsync(client, "admin", "kittisak.cnx", "kittisak-new-pass");

            var customer = await LoginAsync(client, "client", "SOMCHAI@example.test", InMemoryWebApiFactory.DevPassword);
            Assert.Equal(PmsSeedConstants.PrimaryCustomerId, customer.Customer!.Id);
            Assert.Equal(HttpStatusCode.OK, (await GetAsync(client, "/api/v1/client/parcels", customer.AccessToken)).StatusCode);

            using var verify = factory.Services.CreateScope();
            var verifyDb = verify.ServiceProvider.GetRequiredService<TanPmsDbContext>();
            var tokens = await verifyDb.RefreshTokens.AsNoTracking().ToListAsync();
            Assert.All(tokens, t => Assert.Equal(64, t.TokenHash.Length));
            Assert.DoesNotContain(tokens, t => t.TokenHash == session.RefreshToken);
            var audits = await verifyDb.AuditEvents.AsNoTracking().ToListAsync();
            Assert.Contains(audits, a => a.ActionKey == ChangePasswordHandler.ActionKey);
            Assert.DoesNotContain(audits, a => (a.AfterStateJson ?? string.Empty).Contains("kittisak-new-pass", StringComparison.Ordinal));
        }
        finally
        {
            await DropDatabaseAsync(dbName);
        }
    }

    private static async Task<AuthSessionResponse> LoginAsync(HttpClient client, string scope, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(scope, identifier, password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<AuthSessionResponse>())!;
    }

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string path, string accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return await client.SendAsync(request);
    }

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
        try
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(AdminConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE);";
            await cmd.ExecuteNonQueryAsync();
        }
        catch (NpgsqlException)
        {
            // Cleanup is best effort.
        }
    }
}
