using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class UpsertAdminUserHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUserHandler(
        IIdentityStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<AdminUserDto> Handle(UpsertAdminUserCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminUsersManage) is { } permError)
        {
            return Result<AdminUserDto>.Failure(permError);
        }

        if (command.AllowedPropertyIds is null || command.AllowedPropertyIds.Count == 0)
        {
            return Result<AdminUserDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "At least one AllowedPropertyId is required."));
        }

        foreach (var propId in command.AllowedPropertyIds)
        {
            if (ScopeAuthorizationGuard.CheckAdminPropertyAccess(_currentUser, propId) is { } scopeError)
            {
                return Result<AdminUserDto>.Failure(scopeError);
            }
        }

        if (!command.IsActive && command.Id is { } targetId && IdentityRules.CheckNotSelf(_currentUser, targetId) is { } selfError)
        {
            return Result<AdminUserDto>.Failure(selfError);
        }

        var before = command.Id is { } existingId ? _store.GetAdminUser(existingId).Value : null;
        var result = _store.UpsertAdminUser(command);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.AllowedPropertyIds[0],
                actionKey: PermissionKeys.AdminUsersManage,
                entityId: result.Value.Id,
                reason: $"Assigned role {result.Value.RoleCode} to {result.Value.Username}",
                afterState: new
                {
                    result.Value.Username,
                    result.Value.RoleCode,
                    result.Value.IsActive,
                    AllowedPropertyIds = result.Value.AllowedProperties.Select(p => p.Id).ToList()
                },
                beforeState: before is null
                    ? null
                    : new { before.RoleCode, before.IsActive, AllowedPropertyIds = before.AllowedProperties.Select(p => p.Id).ToList() });
        }

        return result;
    }
}
