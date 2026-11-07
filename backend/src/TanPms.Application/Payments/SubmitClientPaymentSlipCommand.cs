namespace TanPms.Application.Payments;

public sealed record SubmitClientPaymentSlipCommand(
    Guid InvoiceId,
    SubmitPaymentSlipRequest Request);
