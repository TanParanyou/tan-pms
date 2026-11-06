using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Identity;

public sealed record RoleDefinitionDto(
    string Code,
    LocalizedTextDto Name,
    string Scope,
    IReadOnlyList<string> DefaultPermissions);
