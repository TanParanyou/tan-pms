using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TanPms.IntegrationTests;

// Header-trust mode (Testing only) keeps the scope/permission suites able to impersonate any caller via X-TanPms-* headers.
public sealed class InMemoryWebApiFactory : WebApplicationFactory<Program>
{
    public const string TestSigningKey = "integration-tests-only-signing-key-0123456789";
    public const string DevPassword = "demo-pass-123";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Persistence:Provider", "InMemory");
        builder.UseSetting("Auth:Mode", "Headers");
        builder.UseSetting("Auth:Jwt:SigningKey", TestSigningKey);
        builder.UseSetting("Auth:RateLimit:Enabled", "false");
        builder.UseSetting("Seed:DevPassword", DevPassword);
    }
}
