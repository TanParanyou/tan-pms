using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

// Admin users are never hard-deleted: their ids are referenced by audit events, shifts, slips and work orders.
public static class IdentityRules
{
    public const string DeactivateActionKey = "admin.users.deactivate";
    public const string ReactivateActionKey = "admin.users.reactivate";

    public static Error? CheckNotSelf(ICurrentUserContext currentUser, Guid userId) =>
        string.Equals(currentUser.UserId, userId.ToString(), StringComparison.OrdinalIgnoreCase)
            ? new Error(DomainErrorCodes.ValidationFailed, "You cannot deactivate your own account.")
            : null;

    // The last active Organization Admin may not be deactivated or demoted, otherwise nobody can manage users.
    public static Error? CheckKeepsAnOrganizationAdmin(AdminUser target, bool willBeActive, string newRoleCode, IEnumerable<AdminUser> allUsers)
    {
        var losesAdmin = target.IsActive
            && target.RoleCode == RoleCodes.OrganizationAdmin
            && (!willBeActive || newRoleCode != RoleCodes.OrganizationAdmin);
        return losesAdmin && !allUsers.Any(u => u.Id != target.Id && u.IsActive && u.RoleCode == RoleCodes.OrganizationAdmin)
            ? new Error(DomainErrorCodes.MasterDataInUse, "The last active Organization Admin cannot be deactivated or demoted.")
            : null;
    }

    // Caller must cover every property of the target user (same rule as the upsert).
    public static Error? CheckCoversUser(ICurrentUserContext currentUser, AdminUserDto user)
    {
        foreach (var property in user.AllowedProperties)
        {
            if (ScopeAuthorizationGuard.CheckAdminPropertyAccess(currentUser, property.Id) is { } scopeError)
            {
                return scopeError;
            }
        }

        return null;
    }

    public static Error NotFound(Guid userId) =>
        new(DomainErrorCodes.ValidationFailed, $"Admin user '{userId}' was not found.");
}
