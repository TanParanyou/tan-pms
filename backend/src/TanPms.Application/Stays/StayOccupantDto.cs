namespace TanPms.Application.Stays;

public sealed record StayOccupantDto(
    Guid Id,
    string FullName,
    string NationalityCode,
    string MaskedIdentityNumber,
    bool IsPrimaryOccupant,
    string? VehicleLicensePlate,
    string? PhoneNumber,
    string? IdentityDocumentFileKey);
