using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Domain.Common;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.ErrorHandling;

namespace TanPms.WebApi.Security;

public static class TanPmsAuthenticationExtensions
{
    public const string AuthRateLimitPolicy = "auth-endpoints";
    public const string TestingEnvironment = "Testing";
    private const int MinimumSigningKeyBytes = 32;

    public static bool IsDevelopmentOrTesting(this IHostEnvironment environment) =>
        environment.IsDevelopment() || environment.IsEnvironment(TestingEnvironment);

    // Fails start-up (throws) on unsafe configuration: Headers mode or a missing/short signing key outside Development/Testing.
    public static AuthMode AddTanPmsAuthentication(this WebApplicationBuilder builder)
    {
        var configuration = builder.Configuration;
        var isDevOrTest = builder.Environment.IsDevelopmentOrTesting();

        var modeText = configuration["Auth:Mode"];
        var mode = AuthMode.Jwt;
        if (!string.IsNullOrWhiteSpace(modeText)
            && (!Enum.TryParse(modeText, ignoreCase: true, out mode) || !Enum.IsDefined(mode)))
        {
            throw new InvalidOperationException($"Auth:Mode '{modeText}' is invalid; use Jwt or Headers.");
        }

        if (mode == AuthMode.Headers && !isDevOrTest)
        {
            throw new InvalidOperationException("Auth:Mode=Headers is allowed only in Development or Testing environments.");
        }

        var keyText = configuration["Auth:Jwt:SigningKey"];
        byte[] signingKey;
        if (string.IsNullOrEmpty(keyText))
        {
            // Dev/Testing without a configured key: tokens stay valid only for this process lifetime.
            signingKey = isDevOrTest
                ? RandomNumberGenerator.GetBytes(MinimumSigningKeyBytes)
                : throw new InvalidOperationException("Auth:Jwt:SigningKey is required outside Development/Testing.");
        }
        else
        {
            signingKey = Encoding.UTF8.GetBytes(keyText);
            if (signingKey.Length < MinimumSigningKeyBytes)
            {
                throw new InvalidOperationException($"Auth:Jwt:SigningKey must be at least {MinimumSigningKeyBytes} bytes.");
            }
        }

        var jwt = new JwtSettings(
            signingKey,
            RequiredText(configuration, "Auth:Jwt:Issuer", "tan-pms"),
            RequiredText(configuration, "Auth:Jwt:Audience", "tan-pms-web"),
            PositiveInt(configuration, "Auth:Jwt:AccessTokenMinutes", 15),
            configuration.GetValue("Auth:Jwt:RequireHttpsMetadata", !isDevOrTest));
        var security = new AuthSecuritySettings(
            LockoutThreshold: PositiveInt(configuration, "Auth:Lockout:Threshold", 5),
            LockoutMinutes: PositiveInt(configuration, "Auth:Lockout:Minutes", 15),
            RefreshTokenDays: PositiveInt(configuration, "Auth:Jwt:RefreshTokenDays", 7));

        var services = builder.Services;
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton(jwt);
        services.AddSingleton(security);
        services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();
        services.AddScoped<AuthSessionIssuer>();

        if (mode == AuthMode.Headers)
        {
            services.AddScoped<ICurrentUserContext, HttpCurrentUserContext>();
        }
        else
        {
            services.AddScoped<ICurrentUserContext, JwtCurrentUserContext>();
            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.MapInboundClaims = false;
                    options.RequireHttpsMetadata = jwt.RequireHttpsMetadata;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwt.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwt.Audience,
                        ValidateLifetime = true,
                        RequireExpirationTime = true,
                        RequireSignedTokens = true,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(jwt.SigningKey),
                        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                        ClockSkew = TimeSpan.FromSeconds(30),
                        NameClaimType = AuthClaimNames.Subject
                    };
                });
        }

        var rateLimitEnabled = configuration.GetValue("Auth:RateLimit:Enabled", true);
        var permitLimit = PositiveInt(configuration, "Auth:RateLimit:PermitLimit", 10);
        var windowSeconds = PositiveInt(configuration, "Auth:RateLimit:WindowSeconds", 60);
        services.AddRateLimiter(options =>
        {
            options.AddPolicy(AuthRateLimitPolicy, httpContext => rateLimitEnabled
                ? RateLimitPartition.GetFixedWindowLimiter(
                    httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = permitLimit, Window = TimeSpan.FromSeconds(windowSeconds), QueueLimit = 0 })
                : RateLimitPartition.GetNoLimiter("disabled"));
            options.OnRejected = async (rejected, _) =>
            {
                if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    rejected.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }

                await ProblemDetailsMapper
                    .ToProblemResult(new Error(DomainErrorCodes.RateLimited, "Too many attempts."), rejected.HttpContext)
                    .ExecuteAsync(rejected.HttpContext);
            };
        });

        return mode;
    }

    public static void UseTanPmsAuthentication(this WebApplication app, AuthMode mode)
    {
        if (mode == AuthMode.Jwt)
        {
            app.UseAuthentication();
            app.UseMiddleware<AuthGateMiddleware>();
        }

        app.UseRateLimiter();
    }

    // Dev/Testing only: gives seeded accounts the Seed:DevPassword (never runs in Production).
    public static async Task SeedDevCredentialsIfAllowedAsync(this WebApplication app)
    {
        var devPassword = app.Configuration["Seed:DevPassword"];
        if (!app.Environment.IsDevelopmentOrTesting() || string.IsNullOrEmpty(devPassword))
        {
            return;
        }

        var hasher = app.Services.GetRequiredService<IPasswordHasher>();
        if (app.Services.GetService<InMemoryOperationalService>() is { } inMemory)
        {
            inMemory.SeedDevCredentials(hasher, devPassword);
            return;
        }

        if (app.Environment.IsDevelopment())
        {
            await PmsDatabaseInitializer.InitializeIfPostgresAsync(app.Services, app.Configuration, app.Logger, devPassword);
        }
    }

    private static string RequiredText(IConfiguration configuration, string key, string fallback)
    {
        var value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static int PositiveInt(IConfiguration configuration, string key, int fallback)
    {
        var value = configuration.GetValue(key, fallback);
        return value > 0 ? value : throw new InvalidOperationException($"{key} must be a positive integer.");
    }
}
