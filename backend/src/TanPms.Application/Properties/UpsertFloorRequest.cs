using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UpsertFloorRequest(
    Guid? Id,
    Guid BuildingId,
    int FloorNumber,
    LocalizedTextDto Name);
