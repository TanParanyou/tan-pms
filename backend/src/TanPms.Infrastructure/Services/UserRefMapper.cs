using TanPms.Application.Common.Contracts;
using TanPms.Domain.Identity;

namespace TanPms.Infrastructure.Services;

// Resolves stored user ids (AdminUser.Id or Username) to display names so the frontend never joins users itself.
internal static class UserRefMapper
{
    internal static Func<string?, UserRefDto?> Build(IEnumerable<AdminUser> users)
    {
        var list = users.ToList();
        return userId => string.IsNullOrWhiteSpace(userId)
            ? null
            : new UserRefDto(
                userId,
                list.FirstOrDefault(u =>
                    string.Equals(u.Id.ToString(), userId, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(u.Username, userId, StringComparison.OrdinalIgnoreCase))?.FullName);
    }
}
