using TanPms.Domain.Common;

namespace TanPms.Domain.Cashier;

public sealed class DepositTransaction : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid DepositLedgerId { get; set; }
    public required string DocumentNumber { get; set; }
    public required DepositTransactionType TransactionType { get; set; }
    public required decimal Amount { get; set; }
    public string? Reason { get; set; }
    public string? PaymentMethod { get; set; }
}
