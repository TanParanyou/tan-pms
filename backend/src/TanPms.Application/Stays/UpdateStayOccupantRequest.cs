namespace TanPms.Application.Stays;

public sealed record UpdateStayOccupantRequest(
    string FullName,
    string NationalityCode,
    string? IdentityNumber,
    bool IsPrimaryOccupant,
    string? VehicleLicensePlate = null,
    string? PhoneNumber = null,
    string? IdentityDocumentFileKey = null);
