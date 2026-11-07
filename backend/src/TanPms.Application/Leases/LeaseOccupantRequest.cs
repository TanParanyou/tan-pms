namespace TanPms.Application.Leases;

public sealed record LeaseOccupantRequest(
    string FullName,
    string NationalityCode,
    string IdentityNumber,
    bool IsPrimaryOccupant);
