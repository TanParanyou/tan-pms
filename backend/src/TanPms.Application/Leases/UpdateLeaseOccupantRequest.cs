namespace TanPms.Application.Leases;

public sealed record UpdateLeaseOccupantRequest(
    string FullName,
    string NationalityCode,
    string? IdentityNumber,
    bool IsPrimaryOccupant);
