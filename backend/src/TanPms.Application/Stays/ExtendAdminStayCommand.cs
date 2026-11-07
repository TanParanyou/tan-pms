namespace TanPms.Application.Stays;

public sealed record ExtendAdminStayCommand(
    Guid PropertyId,
    Guid StayId,
    ExtendStayRequest Request);
