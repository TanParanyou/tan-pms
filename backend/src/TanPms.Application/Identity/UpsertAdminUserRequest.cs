namespace TanPms.Application.Identity;

public sealed record UpsertAdminUserRequest(
    Guid? Id,
    string Username,
    string FullName,
    string Email,
    string RoleCode,
    IReadOnlyList<Guid> AllowedPropertyIds,
    bool IsActive);
