using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Leases;
using TanPms.Domain.Notifications;

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

    internal static string LeaseStartPeriod(Lease lease) =>
        BillingPeriod.Format(new DateOnly(lease.StartDate.Year, lease.StartDate.Month, 1));

    // Shared occupant-edit rule: a lease always keeps exactly one primary occupant.
    internal static Error? ApplyOccupantUpdate(List<Occupant> leaseOccupants, Guid occupantId, UpdateLeaseOccupantRequest request)
    {
        var occupant = leaseOccupants.FirstOrDefault(o => o.Id == occupantId);
        if (occupant is null)
        {
            return LeaseRequestValidation.OccupantNotFound(occupantId);
        }

        if (occupant.IsPrimaryOccupant && !request.IsPrimaryOccupant)
        {
            return LeaseRequestValidation.PrimaryOccupantRequired();
        }

        occupant.FullName = request.FullName.Trim();
        occupant.NationalityCode = string.IsNullOrWhiteSpace(request.NationalityCode)
            ? occupant.NationalityCode
            : request.NationalityCode.Trim().ToUpperInvariant();
        // Blank keeps the stored number, so a client holding only the masked value cannot overwrite it.
        occupant.IdentityNumber = string.IsNullOrWhiteSpace(request.IdentityNumber) ? occupant.IdentityNumber : request.IdentityNumber.Trim();
        if (request.IsPrimaryOccupant)
        {
            foreach (var other in leaseOccupants)
            {
                other.IsPrimaryOccupant = other.Id == occupant.Id;
            }
        }

        return null;
    }

    internal static Error? CheckOccupantDelete(IReadOnlyList<Occupant> leaseOccupants, Guid occupantId, out Occupant? occupant)
    {
        occupant = leaseOccupants.FirstOrDefault(o => o.Id == occupantId);
        if (occupant is null)
        {
            return LeaseRequestValidation.OccupantNotFound(occupantId);
        }

        return occupant.IsPrimaryOccupant || leaseOccupants.Count <= 1
            ? LeaseRequestValidation.PrimaryOccupantRequired()
            : null;
    }

    internal static void ApplyVehicleUpdate(TenantVehicle vehicle, LeaseVehicleRequest request)
    {
        vehicle.LicensePlate = request.LicensePlate.Trim();
        vehicle.Province = request.Province?.Trim() ?? string.Empty;
        vehicle.VehicleBrandModel = request.VehicleBrandModel?.Trim() ?? string.Empty;
    }

    internal static Error ClientLeaseNotFound() =>
        new(DomainErrorCodes.PermissionDenied, "Lease was not found for the current customer.");

    internal static LeaseIntentDto MapIntent(
        LeaseIntentRequest intent,
        Lease lease,
        UnitRefDto unitRef,
        Customer customer,
        Func<string?, UserRefDto?> users,
        bool unmaskPii) => new(
        intent.Id,
        intent.PropertyId,
        intent.LeaseId,
        lease.DocumentNumber,
        unitRef,
        new CustomerRefDto(customer.Id, customer.FullName, unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
        intent.IntentType.ToString(),
        intent.DesiredDate,
        intent.Note,
        intent.Status.ToString(),
        users(intent.ReviewedByUserId),
        intent.ReviewedAt,
        intent.RejectReason,
        intent.CreatedAt);

    internal static NotificationMessage BuildIntentNotification(LeaseIntentRequest intent, string leaseDocumentNumber, DateTimeOffset sentAt) => new()
    {
        PropertyId = intent.PropertyId,
        CustomerId = intent.CustomerId,
        Channel = NotificationChannel.InApp,
        TemplateKey = intent.Status == LeaseIntentStatus.Approved ? LeaseIntentRules.ApprovedTemplateKey : LeaseIntentRules.RejectedTemplateKey,
        Title = LeaseIntentRules.NotificationTitle(intent, leaseDocumentNumber),
        Body = LeaseIntentRules.NotificationBody(intent),
        SentAtUtc = sentAt
    };

    internal static LeaseIntentRequest BuildIntent(Lease lease, LeaseIntentType intentType, CreateLeaseIntentRequest request) => new()
    {
        PropertyId = lease.PropertyId,
        LeaseId = lease.Id,
        CustomerId = lease.CustomerId,
        IntentType = intentType,
        DesiredDate = request.DesiredDate,
        Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim()
    };

    internal static Error LeaseNotFound(Guid propertyId, Guid leaseId) => new(
        DomainErrorCodes.ValidationFailed,
        $"Lease '{leaseId}' was not found in property '{propertyId}'.");
}
