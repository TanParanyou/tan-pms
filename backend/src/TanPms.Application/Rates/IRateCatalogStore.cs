using TanPms.Application.Common.Results;

namespace TanPms.Application.Rates;

public interface IRateCatalogStore
{
    Result<PropertyRateCatalogResponse> GetPropertyRateCatalog(Guid propertyId);
    Result<RatePlanItemDto> UpsertRatePlan(Guid propertyId, UpsertRatePlanRequest request);
    Result<UtilityTariffItemDto> UpsertUtilityTariff(Guid propertyId, UpsertUtilityTariffRequest request);
    Result<TaxProfileItemDto> UpsertTaxProfile(Guid propertyId, UpsertTaxProfileRequest request);
    Result<RateSimulationResponse> SimulateRateAndTax(Guid propertyId, RateSimulationRequest request);
}
