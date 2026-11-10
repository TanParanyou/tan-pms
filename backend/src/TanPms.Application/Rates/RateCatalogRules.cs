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
}
