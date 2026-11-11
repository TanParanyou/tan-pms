namespace TanPms.Application.Identity;

public sealed record CustomerAccountDto(
    Guid CustomerId,
    string LoginIdentifier,
    bool IsActive,
    DateTimeOffset? PasswordChangedAt);
