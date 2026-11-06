using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record FloorDetailDto(
    Guid Id,
    int FloorNumber,
    LocalizedTextDto Name,
    int UnitCount);
