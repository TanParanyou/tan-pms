using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Rates;

public sealed record PropertyRateCatalogResponse(
    PropertyRefDto Property,
    IReadOnlyList<RatePlanItemDto> RatePlans,
    IReadOnlyList<UtilityTariffItemDto> UtilityTariffs,
    IReadOnlyList<TaxProfileItemDto> TaxProfiles);
