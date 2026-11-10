using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UpsertBuildingRequest(
    Guid? Id,
    string Code,
    LocalizedTextDto Name);
