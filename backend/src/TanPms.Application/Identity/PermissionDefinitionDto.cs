using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Identity;

public sealed record PermissionDefinitionDto(
    string Key,
    string ModuleCode,
    LocalizedTextDto Description,
    bool IsHighRisk);
