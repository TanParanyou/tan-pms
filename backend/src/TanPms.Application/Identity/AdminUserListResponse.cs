using TanPms.Application.Common.Models;
namespace TanPms.Application.Identity;

public sealed record AdminUserListResponse(
    IReadOnlyList<AdminUserDto> Items,
    PaginationMetadata? Pagination = null);
