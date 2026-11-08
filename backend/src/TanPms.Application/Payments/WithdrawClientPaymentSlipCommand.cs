namespace TanPms.Application.Payments;

public sealed record WithdrawClientPaymentSlipCommand(
    Guid InvoiceId,
    Guid SlipId);
