using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Housekeeping;

public sealed class GetAdminHousekeepingTasksHandler
{
    private readonly IHousekeepingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminHousekeepingTasksHandler(IHousekeepingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<HousekeepingTaskListResponse> Handle(GetAdminHousekeepingTasksQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminHousekeepingUpdate,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<HousekeepingTaskListResponse>.Failure(authError);
        }

        return _store.GetAdminHousekeepingTasks(query.PropertyId, query.Status, query.BuildingId, paging: PageRequest.From(query.Page, query.PageSize));
    }
}
