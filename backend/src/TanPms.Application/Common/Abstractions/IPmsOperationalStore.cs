using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Results;
using TanPms.Application.Rack;
using TanPms.Application.Stays;

namespace TanPms.Application.Common.Abstractions;

public interface IPmsOperationalStore
{
    Result<RoomRackResponse> GetRoomRack(Guid propertyId);
    Result<StaySummaryDto> CheckInStay(
        CheckInStayCommand command,
        bool callerHasOverridePermission);
    Result<ClientDashboardResponse> GetClientDashboard(Guid customerId);
}
