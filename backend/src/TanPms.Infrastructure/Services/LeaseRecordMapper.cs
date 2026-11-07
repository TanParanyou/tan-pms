using TanPms.Application.Common.Results;
using TanPms.Application.Leases;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Leases;

namespace TanPms.Infrastructure.Services;

// Shared by the EF Core and in-memory lease stores so both build and project records identically.
internal static class LeaseRecordMapper
{
    // ICAO 9303 "XXX" = unspecified nationality; Customer has no nationality field.
    internal static LeaseOccupantRequest PrimaryOccupantFromCustomer(Customer customer) => new(
        customer.FullName,
        customer.IsPassport ? "XXX" : "THA",
        customer.NationalIdOrPassport,
        IsPrimaryOccupant: true);

    internal static Occupant BuildLeaseOccupant(Lease lease, LeaseOccupantRequest request) => new()
    {
        PropertyId = lease.PropertyId,
        CustomerId = lease.CustomerId,
        LeaseId = lease.Id,
        FullName = request.FullName.Trim(),
        NationalityCode = string.IsNullOrWhiteSpace(request.NationalityCode)
            ? "THA"
            : request.NationalityCode.Trim().ToUpperInvariant(),
        IdentityNumber = request.IdentityNumber.Trim(),
        IsPrimaryOccupant = request.IsPrimaryOccupant
    };

    internal static TenantVehicle BuildTenantVehicle(Lease lease, LeaseVehicleRequest request) => new()
    {
        PropertyId = lease.PropertyId,
        LeaseId = lease.Id,
        CustomerId = lease.CustomerId,
        LicensePlate = request.LicensePlate.Trim(),
        Province = request.Province?.Trim() ?? string.Empty,
        VehicleBrandModel = request.VehicleBrandModel?.Trim() ?? string.Empty
    };

    internal static LeaseOccupantDto MapLeaseOccupant(Occupant occupant, bool unmaskPii) => new(
        occupant.Id,
        occupant.FullName,
        occupant.NationalityCode,
        unmaskPii ? occupant.IdentityNumber : occupant.GetMaskedIdentity(),
        occupant.IsPrimaryOccupant);

    internal static LeaseVehicleDto MapLeaseVehicle(TenantVehicle vehicle) => new(
        vehicle.Id,
        vehicle.LicensePlate,
        vehicle.Province,
        vehicle.VehicleBrandModel);

    internal static Error LeaseNotFound(Guid propertyId, Guid leaseId) => new(
        DomainErrorCodes.ValidationFailed,
        $"Lease '{leaseId}' was not found in property '{propertyId}'.");
}
