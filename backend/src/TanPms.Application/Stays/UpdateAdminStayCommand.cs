namespace TanPms.Application.Stays;

public sealed record UpdateAdminStayCommand(
    Guid PropertyId,
    Guid StayId,
    UpdateStayRequest Request);
