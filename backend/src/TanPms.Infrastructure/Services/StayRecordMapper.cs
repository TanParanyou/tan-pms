using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

// Shared by the EF Core and in-memory stores so stay occupants and folio charges are built and projected identically.
internal static class StayRecordMapper
{
    internal static Occupant BuildOccupant(Guid propertyId, Guid customerId, Guid stayId, CheckInOccupantInputDto input) => new()
    {
        PropertyId = propertyId,
        CustomerId = customerId,
        StayId = stayId,
        FullName = input.FullName.Trim(),
        NationalityCode = string.IsNullOrWhiteSpace(input.NationalityCode) ? "THA" : input.NationalityCode.Trim().ToUpperInvariant(),
        IdentityNumber = input.IdentityNumber.Trim(),
        IsPrimaryOccupant = input.IsPrimaryOccupant,
        VehicleLicensePlate = Clean(input.VehicleLicensePlate),
        PhoneNumber = Clean(input.PhoneNumber),
        IdentityDocumentFileKey = Clean(input.IdentityDocumentFileKey)
    };

    internal static StayOccupantDto MapOccupant(Occupant occupant, bool unmaskPii) => new(
        occupant.Id,
        occupant.FullName,
        occupant.NationalityCode,
        unmaskPii ? occupant.IdentityNumber : occupant.GetMaskedIdentity(),
        occupant.IsPrimaryOccupant,
        occupant.VehicleLicensePlate,
        occupant.PhoneNumber,
        occupant.IdentityDocumentFileKey);

    internal static FolioChargeItemDto MapCharge(FolioCharge charge) => new(
        charge.Id,
        LocalizedTextDto.FromDomain(charge.Description),
        charge.Amount,
        charge.TaxMode.ToString(),
        charge.IsVoided,
        charge.VoidReason);

    internal static Error? ValidateOccupantInput(string? fullName, string? identityNumber, bool identityRequired) =>
        string.IsNullOrWhiteSpace(fullName) || (identityRequired && string.IsNullOrWhiteSpace(identityNumber))
            ? new Error(DomainErrorCodes.ValidationFailed, "Occupant FullName and IdentityNumber are required.")
            : null;

    // A stay always keeps exactly one primary occupant (the registered guest for TM.30 / regulatory export).
    internal static Error? ApplyOccupantUpdate(List<Occupant> stayOccupants, Guid occupantId, UpdateStayOccupantRequest request)
    {
        var occupant = stayOccupants.FirstOrDefault(o => o.Id == occupantId);
        if (occupant is null)
        {
            return OccupantNotFound(occupantId);
        }

        if (occupant.IsPrimaryOccupant && !request.IsPrimaryOccupant)
        {
            return PrimaryOccupantRequired();
        }

        occupant.FullName = request.FullName.Trim();
        occupant.NationalityCode = string.IsNullOrWhiteSpace(request.NationalityCode) ? occupant.NationalityCode : request.NationalityCode.Trim().ToUpperInvariant();
        // Blank keeps the stored number, so a client holding only the masked value cannot overwrite it.
        occupant.IdentityNumber = string.IsNullOrWhiteSpace(request.IdentityNumber) ? occupant.IdentityNumber : request.IdentityNumber.Trim();
        occupant.VehicleLicensePlate = Clean(request.VehicleLicensePlate);
        occupant.PhoneNumber = Clean(request.PhoneNumber);
        occupant.IdentityDocumentFileKey = Clean(request.IdentityDocumentFileKey) ?? occupant.IdentityDocumentFileKey;
        if (request.IsPrimaryOccupant)
        {
            DemoteOthers(stayOccupants, occupant.Id);
        }

        return null;
    }

    internal static void DemoteOthers(IEnumerable<Occupant> stayOccupants, Guid primaryOccupantId)
    {
        foreach (var other in stayOccupants)
        {
            other.IsPrimaryOccupant = other.Id == primaryOccupantId;
        }
    }

    internal static Error? CheckOccupantDelete(IReadOnlyList<Occupant> stayOccupants, Guid occupantId, out Occupant? occupant)
    {
        occupant = stayOccupants.FirstOrDefault(o => o.Id == occupantId);
        if (occupant is null)
        {
            return OccupantNotFound(occupantId);
        }

        return occupant.IsPrimaryOccupant || stayOccupants.Count <= 1 ? PrimaryOccupantRequired() : null;
    }

    internal static Error? ValidateReversal(ReverseFolioPaymentRequest request) =>
        request.Amount <= 0m
            ? new Error(DomainErrorCodes.ValidationFailed, "Reversal Amount must be greater than zero.")
            : request.PaymentMethod is not ("Cash" or "BankTransfer" or "PromptPay")
                ? new Error(DomainErrorCodes.ValidationFailed, $"Invalid PaymentMethod '{request.PaymentMethod}'.")
                : string.IsNullOrWhiteSpace(request.Reason)
                    ? new Error(DomainErrorCodes.ValidationFailed, "Reason is required.")
                    : null;

    internal static Error? ValidateNote(string? note) =>
        note is { Length: > 1000 } ? new Error(DomainErrorCodes.ValidationFailed, "Note cannot exceed 1000 characters.") : null;

    internal static Error StayNotFound(Guid propertyId, Guid stayId) =>
        new(DomainErrorCodes.ValidationFailed, $"Stay '{stayId}' was not found in property '{propertyId}'.");

    private static Error OccupantNotFound(Guid occupantId) =>
        new(DomainErrorCodes.ValidationFailed, $"Occupant '{occupantId}' was not found on this stay.");

    private static Error PrimaryOccupantRequired() =>
        new(DomainErrorCodes.ValidationFailed, "A stay must keep exactly one primary occupant; the primary or last occupant cannot be removed or demoted.");

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
