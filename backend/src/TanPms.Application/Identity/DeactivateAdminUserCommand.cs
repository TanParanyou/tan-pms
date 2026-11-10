using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Identity;

public sealed record DeactivateAdminUserCommand(
    Guid UserId,
    ReasonRequest Request);
