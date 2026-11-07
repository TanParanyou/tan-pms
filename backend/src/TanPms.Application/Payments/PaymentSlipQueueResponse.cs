namespace TanPms.Application.Payments;

public sealed record PaymentSlipQueueResponse(
    IReadOnlyList<AdminPaymentSlipDto> Items);
