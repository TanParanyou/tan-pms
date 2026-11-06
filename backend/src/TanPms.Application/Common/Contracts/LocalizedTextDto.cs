using System.Text.Json.Serialization;
using TanPms.Domain.Common;

namespace TanPms.Application.Common.Contracts;

public sealed record LocalizedTextDto(
    [property: JsonPropertyName("th")] string Th,
    [property: JsonPropertyName("en")] string? En = null)
{
    public static LocalizedTextDto FromDomain(LocalizedText source) =>
        new(source.Thai, source.English);
}
