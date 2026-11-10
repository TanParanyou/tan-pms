using System.Diagnostics;
using System.Globalization;
using System.Resources;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.WebApi.ErrorHandling;

public static class ProblemDetailsMapper
{
    private static readonly ResourceManager ResourceManager = new(
        "TanPms.WebApi.Resources.Errors",
        typeof(ProblemDetailsMapper).Assembly);

    public static int GetStatus(string code) => code switch
    {
        DomainErrorCodes.ValidationFailed => StatusCodes.Status400BadRequest,
        DomainErrorCodes.LocalizedTextThaiRequired => StatusCodes.Status400BadRequest,
        DomainErrorCodes.LocalizedTextTooLong => StatusCodes.Status400BadRequest,
        DomainErrorCodes.Unauthenticated => StatusCodes.Status401Unauthorized,
        DomainErrorCodes.InvalidCredentials => StatusCodes.Status401Unauthorized,
        DomainErrorCodes.PropertyScopeDenied => StatusCodes.Status403Forbidden,
        DomainErrorCodes.PermissionDenied => StatusCodes.Status403Forbidden,
        DomainErrorCodes.UnitNotClean => StatusCodes.Status409Conflict,
        DomainErrorCodes.ReservationSlotOverlap => StatusCodes.Status409Conflict,
        DomainErrorCodes.ReservationQuotaExhausted => StatusCodes.Status409Conflict,
        DomainErrorCodes.ReservationHoldExpired => StatusCodes.Status409Conflict,
        DomainErrorCodes.StayFolioUnsettled => StatusCodes.Status409Conflict,
        DomainErrorCodes.InvoiceImmutableStatus => StatusCodes.Status409Conflict,
        DomainErrorCodes.ShiftNotOpen => StatusCodes.Status409Conflict,
        DomainErrorCodes.MeterRolloverUnconfirmed => StatusCodes.Status409Conflict,
        DomainErrorCodes.MasterDataInUse => StatusCodes.Status409Conflict,
        _ => StatusCodes.Status500InternalServerError
    };

    public static ApiProblemDetails CreateProblem(Error error, HttpContext context)
    {
        var knownCode = string.IsNullOrWhiteSpace(error.Code)
            ? "internal.unexpected_error"
            : error.Code;
        var status = GetStatus(knownCode);
        var culture = ResolveRequestCulture(context);

        var title = ResourceManager.GetString($"{knownCode}_TITLE", culture) ?? knownCode;
        var localizedDetail = ResourceManager.GetString($"{knownCode}_DETAIL", culture);
        var detail = !string.IsNullOrWhiteSpace(localizedDetail)
            ? localizedDetail
            : (!string.IsNullOrWhiteSpace(error.Message) ? error.Message : knownCode);

        return new ApiProblemDetails
        {
            Type = $"https://tan-pms.internal/errors/{knownCode}",
            Title = title,
            Detail = detail,
            Status = status,
            Instance = context.Request.Path.Value ?? "/",
            Code = knownCode,
            ErrorCode = knownCode,
            TraceId = Activity.Current?.Id ?? context.TraceIdentifier
        };
    }

    public static IResult ToProblemResult(Error error, HttpContext context)
    {
        var problem = CreateProblem(error, context);
        return Results.Json(
            problem,
            contentType: "application/problem+json",
            statusCode: problem.Status);
    }

    private static CultureInfo ResolveRequestCulture(HttpContext context)
    {
        var acceptLanguage = context.Request.Headers.AcceptLanguage.ToString();
        if (!string.IsNullOrWhiteSpace(acceptLanguage)
            && acceptLanguage.StartsWith("en", StringComparison.OrdinalIgnoreCase))
        {
            return new CultureInfo("en");
        }

        return new CultureInfo("th");
    }
}
