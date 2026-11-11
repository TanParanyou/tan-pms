using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Identity;

public interface IIdentityStore
{
    Result<RoleCatalogResponse> GetRoleCatalog();
    Result<AdminUserListResponse> GetAdminUsers(Guid? propertyId, IReadOnlySet<Guid> callerAllowedPropertyIds, PageRequest? paging = null);
    // passwordHash is applied only when the user is created; existing passwords change via IAuthStore.SetPassword.
    Result<AdminUserDto> UpsertAdminUser(UpsertAdminUserCommand command, string? passwordHash = null);

    Result<AdminUserDto> GetAdminUser(Guid userId);

    // Soft (de)activation only; enforces IdentityRules.CheckKeepsAnOrganizationAdmin.
    Result<AdminUserDto> SetAdminUserActive(Guid userId, bool isActive);
}
