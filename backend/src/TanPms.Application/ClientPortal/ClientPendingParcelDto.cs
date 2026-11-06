namespace TanPms.Application.ClientPortal;

public sealed record ClientPendingParcelDto(
    Guid Id,
    string DocumentNumber,
    string CarrierName,
    DateTimeOffset ArrivedAt);
