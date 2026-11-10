using TanPms.Application.Cashier;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Leases;

namespace TanPms.Application.Leases;

// Shared shape validation so both persistence providers reject the same requests.
public static class LeaseRequestValidation
{
    public static Error? ParseStatusFilter(string? status, out LeaseStatus? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        if (!Enum.TryParse<LeaseStatus>(status, ignoreCase: true, out var value))
        {
            return Invalid($"Invalid LeaseStatus '{status}'.");
        }

        parsed = value;
        return null;
    }

    public static Error? ValidateCreate(CreateLeaseRequest request)
    {
        if (request.EndDate <= request.StartDate)
        {
            return Invalid("EndDate must be after StartDate.");
        }

        if (request.MonthlyRentAmount < 0m || request.SecurityDepositAmount < 0m)
        {
            return Invalid("MonthlyRentAmount and SecurityDepositAmount cannot be negative.");
        }

        if (request.InitialWaterMeterReading < 0m || request.InitialElectricMeterReading < 0m)
        {
            return Invalid("Initial meter readings cannot be negative.");
        }

        if (request.PaymentMethod is not null && PaymentMethods.Validate(request.PaymentMethod) is { } methodError)
        {
            return methodError;
        }

        foreach (var occupant in request.Occupants ?? [])
        {
            if (ValidateOccupant(occupant) is { } occupantError)
            {
                return occupantError;
            }
        }

        var plates = new HashSet<string>();
        foreach (var vehicle in request.Vehicles ?? [])
        {
            if (ValidateVehicle(vehicle) is { } vehicleError)
            {
                return vehicleError;
            }

            if (!plates.Add(LicensePlateNormalizer.Normalize(vehicle.LicensePlate)))
            {
                return Invalid($"LicensePlate '{vehicle.LicensePlate}' is duplicated in the request.");
            }
        }

        return null;
    }

    public static Error? ValidateOccupant(LeaseOccupantRequest request) =>
        string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.IdentityNumber)
            ? Invalid("Occupant FullName and IdentityNumber are required.")
            : null;

    public static Error? ValidateVehicle(LeaseVehicleRequest request) =>
        LicensePlateNormalizer.Normalize(request.LicensePlate).Length == 0
            ? Invalid("Vehicle LicensePlate is required.")
            : null;

    public static Error? ValidateUpdate(UpdateLeaseRequest request)
    {
        if (request.MonthlyRentAmount is null && request.InitialWaterMeterReading is null && request.InitialElectricMeterReading is null)
        {
            return Invalid("At least one lease field must be provided.");
        }

        return string.IsNullOrWhiteSpace(request.Reason)
            ? Invalid("Reason is required when editing an active lease.")
            : null;
    }

    public static Error? ValidateOccupantUpdate(UpdateLeaseOccupantRequest request) =>
        string.IsNullOrWhiteSpace(request.FullName)
            ? Invalid("Occupant FullName is required.")
            : null;

    public static Error InitialReadingsLocked(string documentNumber) =>
        Invalid($"Initial meter readings of lease {documentNumber} cannot change after meter readings were saved.");

    public static Error OccupantNotFound(Guid occupantId) =>
        Invalid($"Occupant '{occupantId}' was not found on this lease.");

    public static Error VehicleNotFound(Guid vehicleId) =>
        Invalid($"Vehicle '{vehicleId}' was not found on this lease.");

    public static Error PrimaryOccupantRequired() =>
        Invalid("A lease must keep exactly one primary occupant; the primary or last occupant cannot be removed or demoted.");

    public static Error CancelBlockedByBilling(string documentNumber) =>
        new(DomainErrorCodes.InvoiceImmutableStatus, $"Lease {documentNumber} already has billed invoices; use move-out settlement instead of cancel.");

    public static Error? ValidateSettle(SettleLeaseMoveOutRequest request)
    {
        if (request.UtilityDeductionAmount < 0m || request.DamageDeductionAmount < 0m)
        {
            return Invalid("Deduction amounts cannot be negative.");
        }

        if (request.RefundPaymentMethod is not null && PaymentMethods.Validate(request.RefundPaymentMethod) is { } methodError)
        {
            return methodError;
        }

        return string.IsNullOrWhiteSpace(request.Reason)
            ? Invalid("Reason is required for move-out settlement.")
            : null;
    }

    private static Error Invalid(string message) => new(DomainErrorCodes.ValidationFailed, message);
}
