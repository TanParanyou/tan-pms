using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UnitAssetDto(
    Guid Id,
    string AssetCode,
    LocalizedTextDto Name,
    decimal ReplacementCostAmount);
