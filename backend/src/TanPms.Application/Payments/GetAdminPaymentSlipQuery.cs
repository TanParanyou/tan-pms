namespace TanPms.Application.Payments;

public sealed record GetAdminPaymentSlipQuery(
    Guid PropertyId,
    Guid SlipId);
