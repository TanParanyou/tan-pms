namespace TanPms.Application.Identity;

public sealed record RoleCatalogResponse(
    IReadOnlyList<RoleDefinitionDto> Roles,
    IReadOnlyList<PermissionDefinitionDto> Permissions);
