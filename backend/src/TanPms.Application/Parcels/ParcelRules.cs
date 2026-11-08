using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Operations;

namespace TanPms.Application.Parcels;

// Shared parcel rules and in-app notification text for both persistence providers.
public static class ParcelRules
{
    public const string ArrivedTemplateKey = "parcel.arrived";

    public static Error? ValidateReceive(ReceiveParcelRequest request) =>
        request.UnitId == Guid.Empty || string.IsNullOrWhiteSpace(request.CarrierName)
            ? new Error(DomainErrorCodes.ValidationFailed, "UnitId and CarrierName are required.")
            : null;

    public static Error? ParseStatus(string? status, out ParcelStatus? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        if (!Enum.TryParse<ParcelStatus>(status, ignoreCase: true, out var value) || !Enum.IsDefined(value))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid ParcelStatus '{status}'.");
        }

        parsed = value;
        return null;
    }

    public static Parcel Build(Guid propertyId, string documentNumber, Guid customerId, ReceiveParcelRequest request, DateTimeOffset arrivedAt) => new()
    {
        PropertyId = propertyId,
        DocumentNumber = documentNumber,
        UnitId = request.UnitId,
        CustomerId = customerId,
        CarrierName = request.CarrierName.Trim(),
        TrackingNumber = string.IsNullOrWhiteSpace(request.TrackingNumber) ? null : request.TrackingNumber.Trim(),
        ParcelPhotoFileKey = string.IsNullOrWhiteSpace(request.PhotoFileKey) ? null : request.PhotoFileKey.Trim(),
        ArrivedAt = arrivedAt
    };

    public static LocalizedText ArrivedTitle(string documentNumber) =>
        LocalizedText.Create($"มีพัสดุมาถึง {documentNumber}", $"Parcel {documentNumber} has arrived");

    public static LocalizedText ArrivedBody(string carrierName, string unitNumber) =>
        LocalizedText.Create(
            $"พัสดุจาก {carrierName} สำหรับห้อง {unitNumber} รอรับที่เคาน์เตอร์",
            $"A parcel from {carrierName} for unit {unitNumber} is ready for pickup at the front desk",
            maxLength: 1000);
}
