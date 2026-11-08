using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Parcels;

public sealed record VoidAdminParcelCommand(
    Guid PropertyId,
    Guid ParcelId,
    ReasonRequest Request);
