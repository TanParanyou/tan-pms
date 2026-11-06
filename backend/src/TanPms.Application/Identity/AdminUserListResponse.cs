namespace TanPms.Application.Identity;

public sealed record AdminUserListResponse(
    IReadOnlyList<AdminUserDto> Items);
