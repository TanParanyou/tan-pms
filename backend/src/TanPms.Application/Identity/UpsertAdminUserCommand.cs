namespace TanPms.Application.Identity;

public sealed record UpsertAdminUserCommand(
    Guid? Id,
    string Username,
    string FullName,
    string Email,
    string RoleCode,
    IReadOnlyList<Guid> AllowedPropertyIds,
    bool IsActive,
    string? InitialPassword = null);
