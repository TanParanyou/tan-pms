namespace TanPms.Application.Leases;

public sealed record LeaseOccupantDto(
    Guid Id,
    string FullName,
    string NationalityCode,
    string MaskedIdentityNumber,
    bool IsPrimaryOccupant);
