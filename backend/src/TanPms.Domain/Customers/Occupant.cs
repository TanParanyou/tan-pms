using TanPms.Domain.Common;

namespace TanPms.Domain.Customers;

public sealed class Occupant : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? StayId { get; set; }
    public Guid? LeaseId { get; set; }
    public required string FullName { get; set; }
    public required string NationalityCode { get; set; }
    public required string IdentityNumber { get; set; }
    public bool IsPrimaryOccupant { get; set; }
    public string? VehicleLicensePlate { get; set; }

    public bool IsForeignNational =>
        !string.Equals(NationalityCode?.Trim(), "THA", StringComparison.OrdinalIgnoreCase);

    public string GetMaskedIdentity() =>
        PiiMasker.MaskIdentity(IdentityNumber, isPassport: IsForeignNational);
}
