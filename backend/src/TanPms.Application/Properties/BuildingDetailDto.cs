using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record BuildingDetailDto(
    Guid Id,
    string Code,
    LocalizedTextDto Name,
    IReadOnlyList<FloorDetailDto> Floors);
