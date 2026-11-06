using TanPms.Domain.Common;

namespace TanPms.Domain.Leases;

public sealed class TenantVehicle : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid LeaseId { get; set; }
    public required Guid CustomerId { get; set; }
    public required string LicensePlate { get; set; }
    public string Province { get; set; } = string.Empty;
    public string VehicleBrandModel { get; set; } = string.Empty;
}
