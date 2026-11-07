namespace TanPms.Application.Stays;

public sealed record CheckInOccupantInputDto(
    string FullName,
    string NationalityCode,
    string IdentityNumber,
    bool IsPrimaryOccupant,
    string? VehicleLicensePlate = null);
