namespace TanPms.Application.Stays;

public sealed record UpdateAdminStayOccupantCommand(
    Guid PropertyId,
    Guid StayId,
    Guid OccupantId,
    UpdateStayOccupantRequest Request);
