namespace TanPms.Application.Stays;

public sealed record CheckOutAdminStayCommand(
    Guid PropertyId,
    Guid StayId,
    CheckOutStayRequest Request);
