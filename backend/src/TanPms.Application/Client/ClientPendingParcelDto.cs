namespace TanPms.Application.Client;

public sealed record ClientPendingParcelDto(
    Guid Id,
    string DocumentNumber,
    string CarrierName,
    DateTimeOffset ArrivedAt);
