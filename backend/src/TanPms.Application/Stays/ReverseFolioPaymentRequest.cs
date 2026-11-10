namespace TanPms.Application.Stays;

public sealed record ReverseFolioPaymentRequest(
    decimal Amount,
    string PaymentMethod,
    string Reason);
