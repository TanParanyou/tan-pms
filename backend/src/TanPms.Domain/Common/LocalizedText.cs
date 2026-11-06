using System.Text.Json.Serialization;

namespace TanPms.Domain.Common;

public sealed record LocalizedText
{
    [JsonPropertyName("th")]
    public string Thai { get; init; }

    [JsonPropertyName("en")]
    public string? English { get; init; }

    [JsonConstructor]
    public LocalizedText(string thai, string? english = null)
    {
        Thai = thai;
        English = english;
    }

    public static LocalizedText Create(string thai, string? english = null, int maxLength = 250)
    {
        if (string.IsNullOrWhiteSpace(thai))
        {
            throw new DomainRuleException(
                DomainErrorCodes.LocalizedTextThaiRequired,
                "Thai text (th) is required.",
                httpStatus: 400);
        }

        var normalizedThai = thai.Trim();
        if (normalizedThai.Length > maxLength)
        {
            throw new DomainRuleException(
                DomainErrorCodes.LocalizedTextTooLong,
                $"Thai text exceeds maximum length of {maxLength}.",
                httpStatus: 400);
        }

        string? normalizedEnglish = null;
        if (!string.IsNullOrWhiteSpace(english))
        {
            normalizedEnglish = english.Trim();
            if (normalizedEnglish.Length > maxLength)
            {
                throw new DomainRuleException(
                    DomainErrorCodes.LocalizedTextTooLong,
                    $"English text exceeds maximum length of {maxLength}.",
                    httpStatus: 400);
            }
        }

        return new LocalizedText(normalizedThai, normalizedEnglish);
    }

    public static LocalizedText? CreateOptional(string? thai, string? english = null, int maxLength = 2000)
    {
        var normalizedThai = string.IsNullOrWhiteSpace(thai) ? null : thai.Trim();
        var normalizedEnglish = string.IsNullOrWhiteSpace(english) ? null : english.Trim();

        if (normalizedThai is null && normalizedEnglish is null)
        {
            return null;
        }

        if (normalizedThai is not null && normalizedThai.Length > maxLength)
        {
            throw new DomainRuleException(
                DomainErrorCodes.LocalizedTextTooLong,
                $"Thai text exceeds maximum length of {maxLength}.",
                httpStatus: 400);
        }

        if (normalizedEnglish is not null && normalizedEnglish.Length > maxLength)
        {
            throw new DomainRuleException(
                DomainErrorCodes.LocalizedTextTooLong,
                $"English text exceeds maximum length of {maxLength}.",
                httpStatus: 400);
        }

        return new LocalizedText(normalizedThai ?? string.Empty, normalizedEnglish);
    }

    public string Resolve(string? locale = null)
    {
        if (!string.IsNullOrWhiteSpace(locale)
            && locale.StartsWith("en", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(English))
        {
            return English;
        }

        return Thai;
    }
}
