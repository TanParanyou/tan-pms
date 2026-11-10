using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record VoidAdminFolioChargeCommand(
    Guid PropertyId,
    Guid StayId,
    Guid ChargeId,
    ReasonRequest Request);
