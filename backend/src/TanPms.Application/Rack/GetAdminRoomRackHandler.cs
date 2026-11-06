using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Rack;

public sealed class GetAdminRoomRackHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminRoomRackHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RoomRackResponse> Handle(GetAdminRoomRackQuery query)
    {
        if (!_currentUser.IsAdminScope)
        {
            return Result<RoomRackResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires AdminScope authorization."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(query.PropertyId))
        {
            return Result<RoomRackResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{query.PropertyId}'."));
        }

        return _store.GetRoomRack(query.PropertyId);
    }
}
