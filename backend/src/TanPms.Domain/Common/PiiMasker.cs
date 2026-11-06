namespace TanPms.Domain.Common;

public static class PiiMasker
{
    public static string MaskThaiNationalId(string rawNationalId)
    {
        if (string.IsNullOrWhiteSpace(rawNationalId))
        {
            return "x-xxxx-xxxxx-xx-x";
        }

        var digits = new string(rawNationalId.Where(char.IsDigit).ToArray());
        if (digits.Length == 13)
        {
            return $"{digits[0]}-xxxx-xxxxx-{digits.Substring(10, 2)}-{digits[12]}";
        }

        return MaskPassport(rawNationalId);
    }

    public static string MaskPassport(string rawPassport)
    {
        if (string.IsNullOrWhiteSpace(rawPassport))
        {
            return "xxxxxxx";
        }

        var cleaned = rawPassport.Trim();
        if (cleaned.Length <= 4)
        {
            return new string('x', cleaned.Length);
        }

        return $"{cleaned[..2]}xxxx{cleaned[^3..]}";
    }

    public static string MaskIdentity(string rawValue, bool isPassport = false) =>
        isPassport ? MaskPassport(rawValue) : MaskThaiNationalId(rawValue);
}
