namespace TanPms.Application.Payments;

public sealed record UpdateClientPaymentSlipCommand(
    Guid InvoiceId,
    Guid SlipId,
    SubmitPaymentSlipRequest Request);
