using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UpsertUnitAssetItemDto(
    string AssetCode,
    LocalizedTextDto Name,
    decimal ReplacementCostAmount);
