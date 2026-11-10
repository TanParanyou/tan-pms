namespace TanPms.Application.Stays;

public sealed record AddAdminStayOccupantCommand(
    Guid PropertyId,
    Guid StayId,
    CheckInOccupantInputDto Request);
