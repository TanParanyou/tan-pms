using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace TanPms.WebApi.ErrorHandling;

public sealed class ApiProblemDetails : ProblemDetails
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("errorCode")]
    public string ErrorCode { get; set; } = string.Empty;

    [JsonPropertyName("traceId")]
    public string TraceId { get; set; } = string.Empty;

    [JsonPropertyName("errors")]
    public IDictionary<string, string[]> Errors { get; set; } = new Dictionary<string, string[]>();
}
