using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record CancelAdminStayCommand(
    Guid PropertyId,
    Guid StayId,
    ReasonRequest Request);
