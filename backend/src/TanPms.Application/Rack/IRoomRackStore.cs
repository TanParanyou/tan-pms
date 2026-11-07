using TanPms.Application.Common.Results;

namespace TanPms.Application.Rack;

public interface IRoomRackStore
{
    Result<RoomRackResponse> GetRoomRack(Guid propertyId);
}
