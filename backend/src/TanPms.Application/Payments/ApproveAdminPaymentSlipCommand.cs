namespace TanPms.Application.Payments;

public sealed record ApproveAdminPaymentSlipCommand(
    Guid PropertyId,
    Guid SlipId);
