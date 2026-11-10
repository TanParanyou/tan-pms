namespace TanPms.Application.Stays;

public sealed record GetAdminStayQuery(
    Guid PropertyId,
    Guid StayId);
