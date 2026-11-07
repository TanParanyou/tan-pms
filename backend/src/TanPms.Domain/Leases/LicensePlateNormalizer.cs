namespace TanPms.Domain.Leases;

public static class LicensePlateNormalizer
{
    // Plates are typed inconsistently ("1กข-8899", "1 กข 8899"), so compare without spaces/dashes.
    public static string Normalize(string? plate) =>
        string.IsNullOrWhiteSpace(plate)
            ? string.Empty
            : new string(plate.Where(c => !char.IsWhiteSpace(c) && c != '-').ToArray()).ToUpperInvariant();
}
