using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TanPms.Application.Identity;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class JwtKeyRotationAndStartupGuardTests
{
    private const string CurrentKey = "current-signing-key-for-rotation-tests-0002";
    private const string PreviousKey = "previous-signing-key-for-rotation-tests-0001";

    [Fact]
    public async Task Tokens_Carry_The_Current_Kid_And_Previous_Keys_Validate_While_Unknown_Kids_Do_Not()
    {
        await using var factory = CreateFactory(builder =>
        {
            builder.UseSetting("Auth:Jwt:KeyId", "k2");
            builder.UseSetting("Auth:Jwt:PreviousSigningKeys:0:KeyId", "k1");
            builder.UseSetting("Auth:Jwt:PreviousSigningKeys:0:Key", PreviousKey);
        });
        using var client = factory.CreateClient();
        var session = await (await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "naphat.admin", InMemoryWebApiFactory.DevPassword)))
            .Content.ReadFromJsonAsync<AuthSessionResponse>();

        Assert.Equal("k2", new JsonWebToken(session!.AccessToken).Kid);
        Assert.Equal(HttpStatusCode.OK, (await MeAsync(client, session.AccessToken)).StatusCode);

        var viaPrevious = Mint(session.UserId, PreviousKey, "k1");
        var viaPreviousWithoutKid = Mint(session.UserId, PreviousKey, null);
        var unknownKid = Mint(session.UserId, PreviousKey, "unknown");
        var kidOfCurrentButOldKey = Mint(session.UserId, PreviousKey, "k2");
        var unknownKey = Mint(session.UserId, "some-completely-unknown-key-0123456789ab", "k1");
        Assert.Equal(HttpStatusCode.OK, (await MeAsync(client, viaPrevious)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await MeAsync(client, viaPreviousWithoutKid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await MeAsync(client, unknownKid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await MeAsync(client, kidOfCurrentButOldKey)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await MeAsync(client, unknownKey)).StatusCode);
    }

    [Theory]
    [InlineData("k1", "too-short")]
    [InlineData("", PreviousKey)]
    [InlineData("k2", PreviousKey)] // same id as the current key
    public void Startup_Should_Reject_Invalid_Previous_Signing_Keys(string keyId, string key)
    {
        using var factory = CreateFactory(builder =>
        {
            builder.UseSetting("Auth:Jwt:KeyId", "k2");
            builder.UseSetting("Auth:Jwt:PreviousSigningKeys:0:KeyId", keyId);
            builder.UseSetting("Auth:Jwt:PreviousSigningKeys:0:Key", key);
        });
        Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
    }

    [Fact]
    public void Production_Should_Refuse_To_Start_Without_A_Connection_String_Unless_InMemory()
    {
        using var postgres = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Persistence:Provider", "Postgres");
            builder.UseSetting("ConnectionStrings:DefaultConnection", "");
            builder.UseSetting("Auth:Jwt:SigningKey", CurrentKey);
            builder.UseSetting("Auth:RateLimit:Enabled", "false");
        });
        Assert.Throws<InvalidOperationException>(() => postgres.CreateClient());
    }

    private static WebApplicationFactory<Program> CreateFactory(Action<IWebHostBuilder> configure) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Persistence:Provider", "InMemory");
            builder.UseSetting("Auth:Mode", "Jwt");
            builder.UseSetting("Auth:Jwt:SigningKey", CurrentKey);
            builder.UseSetting("Auth:RateLimit:Enabled", "false");
            builder.UseSetting("Seed:DevPassword", InMemoryWebApiFactory.DevPassword);
            configure(builder);
        });

    private static Task<HttpResponseMessage> MeAsync(HttpClient client, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client.SendAsync(request);
    }

    private static string Mint(string subject, string key, string? kid)
    {
        var now = DateTimeOffset.UtcNow;
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = "tan-pms",
            Audience = "tan-pms-web",
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = now.AddMinutes(5).UtcDateTime,
            Subject = new ClaimsIdentity([new Claim("sub", subject), new Claim("scope", "admin"), new Claim("jti", Guid.NewGuid().ToString("N"))]),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)) { KeyId = kid }, SecurityAlgorithms.HmacSha256)
        });
    }
}
