using TanPms.Domain.Common;

namespace TanPms.Domain.Identity;

public sealed class AdminUser : AuditableEntity
{
    public required string Username { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string RoleCode { get; set; }
    public required LocalizedText RoleName { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Guid> AllowedPropertyIds { get; private set; } = [];
    public List<string> Permissions { get; private set; } = [];

    public void AssignRoleAndScope(
        string roleCode,
        LocalizedText roleName,
        IEnumerable<Guid> allowedPropertyIds,
        IEnumerable<string> permissions,
        bool isActive)
    {
        if (string.IsNullOrWhiteSpace(Username))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Username is required.",
                httpStatus: 400);
        }

        if (string.IsNullOrWhiteSpace(roleCode))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "RoleCode is required.",
                httpStatus: 400);
        }

        var distinctPropertyIds = allowedPropertyIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (distinctPropertyIds.Count == 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "AdminUser must be assigned at least one AllowedPropertyId.",
                httpStatus: 400);
        }

        RoleCode = roleCode.Trim();
        RoleName = roleName;
        AllowedPropertyIds = distinctPropertyIds;
        Permissions = permissions
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        IsActive = isActive;
    }
}
