using TanPms.Domain.Common;

namespace TanPms.Domain.DocumentNumbering;

public static class DocumentNumberFormatter
{
    public static string Format(
        string propertyCode,
        DocumentTypeCode documentType,
        int year,
        int month,
        int sequenceNumber)
    {
        if (string.IsNullOrWhiteSpace(propertyCode))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Property code is required.", 400);
        }

        if (month is < 1 or > 12)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Month must be between 1 and 12.", 400);
        }

        if (sequenceNumber <= 0)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Sequence number must be positive.", 400);
        }

        var twoDigitYear = year % 100;
        var normalizedProp = propertyCode.Trim().ToUpperInvariant();
        return $"{normalizedProp}-{documentType}-{twoDigitYear:00}{month:00}-{sequenceNumber:0000}";
    }

    public static string FormatMasterCode(string prefix, int sequenceNumber, int padding = 5)
    {
        if (string.IsNullOrWhiteSpace(prefix) || sequenceNumber <= 0)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Master data prefix and positive sequence are required.", 400);
        }

        var cleanPrefix = prefix.Trim().ToUpperInvariant().TrimEnd('-');
        return $"{cleanPrefix}-{sequenceNumber.ToString().PadLeft(padding, '0')}";
    }
}
