namespace TanPms.Application.Identity;

public sealed record GetAdminUsersQuery(Guid? PropertyId = null,
    int? Page = null,
    int? PageSize = null);
