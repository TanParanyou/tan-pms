using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace TanPms.IntegrationTests;

// Real JWT mode (as in production) on the in-memory store, with an injectable clock and captured logs.
public sealed class JwtWebApiFactory : WebApplicationFactory<Program>
{
    public const string Issuer = "tan-pms-tests";
    public const string Audience = "tan-pms-tests-web";

    public MutableTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

    public CapturingLoggerProvider Logs { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Persistence:Provider", "InMemory");
        builder.UseSetting("Auth:Mode", "Jwt");
        builder.UseSetting("Auth:Jwt:SigningKey", InMemoryWebApiFactory.TestSigningKey);
        builder.UseSetting("Auth:Jwt:Issuer", Issuer);
        builder.UseSetting("Auth:Jwt:Audience", Audience);
        builder.UseSetting("Auth:RateLimit:Enabled", "false");
        builder.UseSetting("Seed:DevPassword", InMemoryWebApiFactory.DevPassword);
        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
        builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Clock));
    }
}
