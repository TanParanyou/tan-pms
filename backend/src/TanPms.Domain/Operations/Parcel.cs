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

    public void MarkPickedUp(DateTimeOffset pickedUpAt)
    {
        PickedUpAt = pickedUpAt;
        Status = ParcelStatus.PickedUp;
    }
}
