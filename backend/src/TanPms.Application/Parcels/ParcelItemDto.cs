using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Parcels;

public sealed record ParcelItemDto(
    Guid Id,
    Guid PropertyId,
    string DocumentNumber,
    string Status,
    UnitRefDto Unit,
    CustomerRefDto Customer,
    string CarrierName,
    string? TrackingNumber,
    string? PhotoFileKey,
    DateTimeOffset ArrivedAt,
    DateTimeOffset? PickedUpAt,
    string? RecipientName,
    string? VoidReason);
