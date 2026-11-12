namespace TanPms.WebApi.Security;

// Baseline response headers on every response; no-store on auth and file/PDF responses; HSTS outside Development
// over HTTPS when Security:Hsts:Enabled (default true).
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _hstsEnabled;
    private readonly bool _isDevelopmentOrTesting;

    public SecurityHeadersMiddleware(RequestDelegate next, IConfiguration configuration, IHostEnvironment environment)
    {
        _next = next;
        _hstsEnabled = configuration.GetValue("Security:Hsts:Enabled", true);
        _isDevelopmentOrTesting = environment.IsDevelopmentOrTesting();
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["Referrer-Policy"] = "no-referrer";
            headers["X-Frame-Options"] = "DENY";

            var path = context.Request.Path;
            var contentType = context.Response.ContentType ?? string.Empty;
            if (path.StartsWithSegments("/api/v1/auth")
                || contentType.StartsWith("application/pdf", StringComparison.OrdinalIgnoreCase)
                || context.Response.Headers.ContentDisposition.Count > 0)
            {
                headers.CacheControl = "no-store";
            }

            if (_hstsEnabled && !_isDevelopmentOrTesting && context.Request.IsHttps)
            {
                headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
            }

            return Task.CompletedTask;
        });
        return _next(context);
    }
}
