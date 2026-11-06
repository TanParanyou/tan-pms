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
}
