using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public sealed class UpsertAdminUserHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUserHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<AdminUserDto> Handle(UpsertAdminUserCommand command)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminUsersManage))
        {
            return Result<AdminUserDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminUsersManage}'."));
        }

        if (command.AllowedPropertyIds is null || command.AllowedPropertyIds.Count == 0)
        {
            return Result<AdminUserDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "At least one AllowedPropertyId is required."));
        }

        foreach (var propId in command.AllowedPropertyIds)
        {
            if (!_currentUser.AllowedPropertyIds.Contains(propId))
            {
                return Result<AdminUserDto>.Failure(new Error(
                    DomainErrorCodes.PropertyScopeDenied,
                    $"Caller cannot assign access to unauthorized property '{propId}'."));
            }
        }

        var result = _store.UpsertAdminUser(command);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.AllowedPropertyIds[0],
                ActionKey = PermissionKeys.AdminUsersManage,
                EntityId = result.Value.Id,
                Reason = $"Assigned role {result.Value.RoleCode} to {result.Value.Username}",
                AfterStateJson = $"{{\"username\":\"{result.Value.Username}\",\"roleCode\":\"{result.Value.RoleCode}\",\"isActive\":{result.Value.IsActive.ToString().ToLowerInvariant()}}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
