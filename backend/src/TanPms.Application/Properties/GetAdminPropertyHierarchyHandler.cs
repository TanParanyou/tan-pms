using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class GetAdminPropertyHierarchyHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPropertyHierarchyHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<PropertyHierarchyResponse> Handle(GetAdminPropertyHierarchyQuery query)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminPropertiesRead))
        {
            return Result<PropertyHierarchyResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminPropertiesRead}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(query.PropertyId))
        {
            return Result<PropertyHierarchyResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{query.PropertyId}'."));
        }

        return _store.GetPropertyHierarchy(query.PropertyId);
    }
}
