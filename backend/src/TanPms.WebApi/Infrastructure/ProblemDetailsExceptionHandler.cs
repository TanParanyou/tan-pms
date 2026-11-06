using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using TanPms.Domain.Exceptions;

namespace TanPms.WebApi.Infrastructure;

public sealed record Rfc9457ProblemDetailsResponse(
    string Type,
    string Title,
    int Status,
    string Detail,
    string Instance,
    string ErrorCode,
    string TraceId,
    IReadOnlyDictionary<string, string[]> Errors);

public sealed class ProblemDetailsExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, errorCode, title, detail) = exception switch
        {
            DomainRuleException domainEx => (
                domainEx.HttpStatus,
                domainEx.ErrorCode,
                domainEx.Title,
                domainEx.Message),
            _ => (
                StatusCodes.Status500InternalServerError,
                "internal.unexpected_error",
                "An unexpected error occurred",
                "The request could not be completed due to an unexpected server error.")
        };

        var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;
        var problem = new Rfc9457ProblemDetailsResponse(
            Type: $"https://tan-pms.internal/errors/{errorCode}",
            Title: title,
            Status: status,
            Detail: detail,
            Instance: httpContext.Request.Path.Value ?? "/",
            ErrorCode: errorCode,
            TraceId: traceId,
            Errors: new Dictionary<string, string[]>());

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            problem,
            options: null,
            contentType: "application/problem+json",
            cancellationToken: cancellationToken);
        return true;
    }
}
