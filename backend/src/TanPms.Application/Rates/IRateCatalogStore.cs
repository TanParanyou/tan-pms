using TanPms.Application.Common.Results;

namespace TanPms.Application.Rates;

public interface IRateCatalogStore
{
    Result<PropertyRateCatalogResponse> GetPropertyRateCatalog(Guid propertyId);
    Result<RatePlanItemDto> UpsertRatePlan(Guid propertyId, UpsertRatePlanRequest request);
    Result<UtilityTariffItemDto> UpsertUtilityTariff(Guid propertyId, UpsertUtilityTariffRequest request);
    Result<TaxProfileItemDto> UpsertTaxProfile(Guid propertyId, UpsertTaxProfileRequest request);
    Result<RatePlanItemDto> GetRatePlan(Guid propertyId, Guid ratePlanId);

    Result<UtilityTariffItemDto> GetUtilityTariff(Guid propertyId, Guid tariffId);

    Result<TaxProfileItemDto> GetTaxProfile(Guid propertyId, Guid taxProfileId);

    Result<RatePlanItemDto> DeleteRatePlan(Guid propertyId, Guid ratePlanId);

    Result<UtilityTariffItemDto> DeleteUtilityTariff(Guid propertyId, Guid tariffId);

    Result<TaxProfileItemDto> DeleteTaxProfile(Guid propertyId, Guid taxProfileId);

    Result<RateSimulationResponse> SimulateRateAndTax(Guid propertyId, RateSimulationRequest request);
}
