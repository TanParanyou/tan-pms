namespace TanPms.Application.Stays;

public sealed record GetAdminStaysQuery(
    Guid PropertyId,
    string? Status,
    string? StayMode);
