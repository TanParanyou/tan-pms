namespace TanPms.Application.Cashier;

public sealed record DepositTransactionDto(
    Guid Id,
    string DocumentNumber,
    string TransactionType,
    decimal Amount,
    string? Reason,
    DateTimeOffset CreatedAt,
    string? PaymentMethod = null);
