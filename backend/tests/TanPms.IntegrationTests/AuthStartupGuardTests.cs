using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using TanPms.Application.Identity;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class AuthStartupGuardTests
{
    [Theory]
    [InlineData("Headers", InMemoryWebApiFactory.TestSigningKey)]
    [InlineData("Jwt", "")]
    [InlineData("Jwt", "too-short-key")]
    [InlineData("Bogus", InMemoryWebApiFactory.TestSigningKey)]
    public void Production_Should_Refuse_To_Start_With_Unsafe_Auth_Configuration(string mode, string signingKey)
    {
        using var factory = CreateProductionFactory(mode, signingKey);
        Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
    }

    [Fact]
    public async Task Production_Should_Start_With_A_Real_Key_But_Never_Seed_Dev_Credentials()
    {
        await using var factory = CreateProductionFactory("Jwt", InMemoryWebApiFactory.TestSigningKey);
        using var client = factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "naphat.admin", InMemoryWebApiFactory.DevPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateProductionFactory(string mode, string signingKey) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Persistence:Provider", "InMemory");
            builder.UseSetting("Auth:Mode", mode);
            builder.UseSetting("Auth:Jwt:SigningKey", signingKey);
            builder.UseSetting("Auth:RateLimit:Enabled", "false");
            // Even when someone sets a dev password in Production it must be ignored.
            builder.UseSetting("Seed:DevPassword", InMemoryWebApiFactory.DevPassword);
        });
}
