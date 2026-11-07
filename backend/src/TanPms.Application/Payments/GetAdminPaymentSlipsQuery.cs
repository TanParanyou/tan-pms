namespace TanPms.Application.Payments;

public sealed record GetAdminPaymentSlipsQuery(
    Guid PropertyId,
    string? Status);
