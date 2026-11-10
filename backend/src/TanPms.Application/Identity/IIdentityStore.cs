using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Identity;

public interface IIdentityStore
{
    Result<AuthSessionResponse> Login(LoginAuthSessionCommand command);
    Result<AuthSessionResponse> GetCurrentAuthSession(ICurrentUserContext currentUser);
    Result<RoleCatalogResponse> GetRoleCatalog();
    Result<AdminUserListResponse> GetAdminUsers(Guid? propertyId, IReadOnlySet<Guid> callerAllowedPropertyIds);
    Result<AdminUserDto> UpsertAdminUser(UpsertAdminUserCommand command);

    Result<AdminUserDto> GetAdminUser(Guid userId);

    // Soft (de)activation only; enforces IdentityRules.CheckKeepsAnOrganizationAdmin.
    Result<AdminUserDto> SetAdminUserActive(Guid userId, bool isActive);
}
