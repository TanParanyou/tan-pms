using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UnitTypeRefDto(
    Guid Id,
    string Code,
    LocalizedTextDto Name,
    decimal AreaSqm);
