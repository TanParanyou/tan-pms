namespace TanPms.Domain.Identity;

// Emails compare case-insensitively; phone numbers compare by digits only ("081-234 5678" == "0812345678").
public static class LoginIdentifierNormalizer
{
    public static string Normalize(string? identifier)
    {
        var trimmed = (identifier ?? string.Empty).Trim();
        if (trimmed.Contains('@', StringComparison.Ordinal))
        {
            return trimmed.ToLowerInvariant();
        }

        return trimmed.Length > 0 && trimmed.All(c => char.IsDigit(c) || c is '+' or '-' or ' ' or '(' or ')')
            ? new string(trimmed.Where(char.IsDigit).ToArray())
            : trimmed.ToLowerInvariant();
    }
}
