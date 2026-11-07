namespace TanPms.Application.Stays;

public sealed record RegulatoryGuestRowDto(
    Guid OccupantId,
    string SourceDocumentNumber,
    string UnitNumber,
    string FullName,
    string NationalityCode,
    string IdentityNumber,
    bool IsPrimaryOccupant,
    string? VehicleLicensePlate,
    DateTimeOffset CheckInAt,
    DateTimeOffset? CheckOutAt,
    string StayMode);
