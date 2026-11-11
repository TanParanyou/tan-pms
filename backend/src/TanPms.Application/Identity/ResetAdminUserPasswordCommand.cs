namespace TanPms.Application.Identity;

public sealed record ResetAdminUserPasswordCommand(
    Guid UserId,
    ResetPasswordRequest Request);
