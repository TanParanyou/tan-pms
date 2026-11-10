namespace TanPms.Application.Stays;

public sealed record DeleteAdminStayOccupantCommand(
    Guid PropertyId,
    Guid StayId,
    Guid OccupantId);
