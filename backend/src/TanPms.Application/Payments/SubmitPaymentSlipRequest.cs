namespace TanPms.Application.Payments;

public sealed record SubmitPaymentSlipRequest(
    decimal Amount,
    string SlipFileKey,
    string? TransferReference = null,
    DateTimeOffset? TransferredAt = null);
