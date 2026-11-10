namespace TanPms.Application.Payments;

public sealed record GetClientPaymentSlipsQuery(
    int? Page = null,
    int? PageSize = null);
