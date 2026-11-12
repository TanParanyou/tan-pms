using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Rates;

public static class RateCatalogRules
{
    // Codes the billing engine looks up by name; deleting their profile would silently change tax on generated lines.
    public static readonly IReadOnlySet<string> ProtectedTaxCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "MONTHLY_ROOM_RENT", "UTILITY_WATER", "UTILITY_ELECTRIC", "REPAIR_CHARGE", "SHORT_STAY_ROOM"
    };

    public static Error NotFound(string entity, Guid propertyId, Guid id) =>
        new(DomainErrorCodes.ValidationFailed, $"{entity} '{id}' was not found in property '{propertyId}'.");

    public static Error? CheckCategoryChangeAllowed(string currentCode, string requestedCode, bool hasReferencingInvoiceLines)
    {
        var normalizedRequested = requestedCode?.Trim() ?? string.Empty;
        if (string.Equals(currentCode, normalizedRequested, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (ProtectedTaxCodes.Contains(currentCode) || hasReferencingInvoiceLines)
        {
            return new Error(
                DomainErrorCodes.ValidationFailed,
                $"ChargeCategoryCode '{currentCode}' cannot be changed because it is a system tax category or is referenced by invoice lines.");
        }

        return null;
    }
}
