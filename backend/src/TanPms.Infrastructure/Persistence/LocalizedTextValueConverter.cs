using System.Text.Json;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TanPms.Domain.Common;

namespace TanPms.Infrastructure.Persistence;

public sealed class LocalizedTextValueConverter : ValueConverter<LocalizedText, string>
{
    public LocalizedTextValueConverter()
        : base(
            v => JsonSerializer.Serialize(new { th = v.Thai, en = v.English }, (JsonSerializerOptions?)null),
            v => Deserialize(v))
    {
    }

    private static LocalizedText Deserialize(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var th = root.TryGetProperty("th", out var thProp) ? thProp.GetString() ?? string.Empty : string.Empty;
        var en = root.TryGetProperty("en", out var enProp) ? enProp.GetString() : null;
        return new LocalizedText(th, en);
    }
}
