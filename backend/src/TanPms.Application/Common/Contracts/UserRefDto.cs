namespace TanPms.Application.Common.Contracts;

// Admin user reference; FullName is null when the id does not match a registered AdminUser (e.g. legacy/dev ids).
public sealed record UserRefDto(
    string Id,
    string? FullName);
