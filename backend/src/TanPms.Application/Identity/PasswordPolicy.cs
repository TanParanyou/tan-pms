using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

public static class PasswordPolicy
{
    public const int MinimumLength = 10;
    public const int MaximumLength = 256;

    public static Error? Validate(string? password) =>
        password is null || password.Length < MinimumLength || password.Length > MaximumLength || string.IsNullOrWhiteSpace(password)
            ? new Error(DomainErrorCodes.PasswordPolicyViolation, $"Password must be {MinimumLength}-{MaximumLength} characters.")
            : null;
}
