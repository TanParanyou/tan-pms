using Microsoft.AspNetCore.Diagnostics;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.WebApi.ErrorHandling;

public sealed class ProblemDetailsExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var error = exception switch
        {
            DomainRuleException domainEx => new Error(domainEx.ErrorCode, domainEx.Message),
            _ => new Error("internal.unexpected_error", "An unexpected error occurred.")
        };

        var problem = ProblemDetailsMapper.CreateProblem(error, httpContext);
        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            problem,
            options: null,
            contentType: "application/problem+json",
            cancellationToken: cancellationToken);
        return true;
    }
}
