using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Identity;

public sealed record AdminUserDto(
    Guid Id,
    string Username,
    string FullName,
    string Email,
    string RoleCode,
    LocalizedTextDto RoleName,
    bool IsActive,
    IReadOnlyList<PropertyRefDto> AllowedProperties,
    IReadOnlyList<string> Permissions);
