using TanPms.Domain.Common;

namespace TanPms.Domain.Operations;

public sealed class Parcel : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public required Guid CustomerId { get; set; }
    public required string CarrierName { get; set; }
    public string? TrackingNumber { get; set; }
    public string? ParcelPhotoFileKey { get; set; }
    public DateTimeOffset ArrivedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PickedUpAt { get; private set; }
    public ParcelStatus Status { get; private set; } = ParcelStatus.Arrived;
    public string? RecipientName { get; private set; }

    // Unit change re-resolves the tenant, so the caller passes the current occupant's CustomerId.
    public void UpdateDetails(Guid unitId, Guid customerId, string carrierName, string? trackingNumber, string? parcelPhotoFileKey)
    {
        EnsureArrived();
        if (string.IsNullOrWhiteSpace(carrierName))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "CarrierName is required.", httpStatus: 400);
        }

        UnitId = unitId;
        CustomerId = customerId;
        CarrierName = carrierName.Trim();
        TrackingNumber = string.IsNullOrWhiteSpace(trackingNumber) ? null : trackingNumber.Trim();
        ParcelPhotoFileKey = string.IsNullOrWhiteSpace(parcelPhotoFileKey) ? ParcelPhotoFileKey : parcelPhotoFileKey.Trim();
    }

    public void EnsureArrived()
    {
        if (Status != ParcelStatus.Arrived)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Parcel {DocumentNumber} was already picked up.",
                httpStatus: 400);
        }
    }

    public void MarkPickedUp(DateTimeOffset pickedUpAt, string? recipientName = null)
    {
        if (Status != ParcelStatus.Arrived)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Parcel {DocumentNumber} was already picked up.",
                httpStatus: 400);
        }

        PickedUpAt = pickedUpAt;
        RecipientName = string.IsNullOrWhiteSpace(recipientName) ? null : recipientName.Trim();
        Status = ParcelStatus.PickedUp;
    }
}
