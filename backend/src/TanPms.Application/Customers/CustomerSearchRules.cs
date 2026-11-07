namespace TanPms.Application.Customers;

// Shared lookup rules so both persistence providers return the same matches.
public static class CustomerSearchRules
{
    public const int MaxResults = 20;

    public static bool Matches(string fullName, string nationalIdOrPassport, string? search)
    {
        var term = search?.Trim();
        if (string.IsNullOrEmpty(term))
        {
            return true;
        }

        return fullName.Contains(term, StringComparison.OrdinalIgnoreCase)
            || nationalIdOrPassport.EndsWith(term, StringComparison.OrdinalIgnoreCase);
    }
}
