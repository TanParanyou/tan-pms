using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record FloorRefDto(
    Guid Id,
    int FloorNumber,
    LocalizedTextDto Name);
