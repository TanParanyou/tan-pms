namespace TanPms.Application.Stays;

public sealed record RecordFolioPaymentRequest(
    decimal Amount,
    string PaymentMethod);
