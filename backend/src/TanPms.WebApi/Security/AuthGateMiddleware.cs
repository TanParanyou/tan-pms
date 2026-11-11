using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.WebApi.ErrorHandling;

namespace TanPms.WebApi.Security;

// Jwt mode: every /api/v1 route except login/refresh needs a valid token of an active subject (401), and the token's
// scope must match the route family (/admin vs /client, 403). Handlers still apply permission/property checks.
public sealed class AuthGateMiddleware
{
    private static readonly string[] AnonymousPaths = ["/api/v1/auth/login", "/api/v1/auth/refresh"];

    private readonly RequestDelegate _next;

    public AuthGateMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ICurrentUserContext currentUser)
    {
        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api/v1", StringComparison.OrdinalIgnoreCase)
            || AnonymousPaths.Any(p => path.Equals(p, StringComparison.OrdinalIgnoreCase))
            || HttpMethods.IsOptions(context.Request.Method))
        {
            await _next(context);
            return;
        }

        Error? error = null;
        if (string.IsNullOrWhiteSpace(currentUser.UserId))
        {
            error = new Error(DomainErrorCodes.Unauthenticated, "A valid bearer token is required.");
        }
        else if ((path.StartsWithSegments("/api/v1/admin", StringComparison.OrdinalIgnoreCase) && !currentUser.IsAdminScope)
            || (path.StartsWithSegments("/api/v1/client", StringComparison.OrdinalIgnoreCase) && !currentUser.IsClientScope))
        {
            error = new Error(DomainErrorCodes.PermissionDenied, "The token scope does not match this endpoint.");
        }

        if (error is not null)
        {
            await ProblemDetailsMapper.ToProblemResult(error, context).ExecuteAsync(context);
            return;
        }

        await _next(context);
    }
}
