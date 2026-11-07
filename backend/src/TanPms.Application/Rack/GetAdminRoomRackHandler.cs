using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Rack;

public sealed class GetAdminRoomRackHandler
{
    private readonly IRoomRackStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminRoomRackHandler(IRoomRackStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RoomRackResponse> Handle(GetAdminRoomRackQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyAccess(_currentUser, query.PropertyId) is { } authError)
        {
            return Result<RoomRackResponse>.Failure(authError);
        }

        return _store.GetRoomRack(query.PropertyId);
    }
}
