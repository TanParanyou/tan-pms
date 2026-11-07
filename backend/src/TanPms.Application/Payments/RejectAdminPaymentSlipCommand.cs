namespace TanPms.Application.Payments;

public sealed record RejectAdminPaymentSlipCommand(
    Guid PropertyId,
    Guid SlipId,
    RejectPaymentSlipRequest Request);
