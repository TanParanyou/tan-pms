using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Rates;

public sealed record TaxProfileItemDto(
    Guid Id,
    string ChargeCategoryCode,
    LocalizedTextDto Name,
    string TaxMode,
    decimal VatRatePercent,
    decimal DefaultWithholdingTaxPercent,
    bool IsActive);
