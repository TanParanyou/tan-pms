using System.Text.Json.Nodes;

namespace TanPms.Domain.Common;

public static class AuditRedactor
{
    private static readonly HashSet<string> SensitiveKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "nationalId",
        "nationalIdOrPassport",
        "passportNumber",
        "password",
        "token",
        "secret"
    };

    public static IReadOnlyDictionary<string, string> RedactMap(IReadOnlyDictionary<string, string> fields)
    {
        var sanitized = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, value) in fields)
        {
            sanitized[key] = SensitiveKeys.Contains(key)
                ? PiiMasker.MaskIdentity(value)
                : value;
        }

        return sanitized;
    }

    public const string RedactedValue = "[REDACTED]";

    // Credential material is removed entirely (not masked) wherever it appears in audit JSON.
    private static readonly string[] SecretKeyFragments = ["password", "passwd", "secret", "token", "signingkey"];

    public static bool IsSecretKey(string key)
    {
        var lowered = key.ToLowerInvariant();
        return SecretKeyFragments.Any(fragment => lowered.Contains(fragment, StringComparison.Ordinal));
    }

    public static string? RedactJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return json;
        }

        var node = JsonNode.Parse(json);
        RedactNode(node);
        return node?.ToJsonString();
    }

    private static void RedactNode(JsonNode? node)
    {
        if (node is JsonObject obj)
        {
            foreach (var key in obj.Select(p => p.Key).ToList())
            {
                if (IsSecretKey(key))
                {
                    obj[key] = RedactedValue;
                }
                else
                {
                    RedactNode(obj[key]);
                }
            }
        }
        else if (node is JsonArray array)
        {
            foreach (var item in array)
            {
                RedactNode(item);
            }
        }
    }
}
