using TanPms.Domain.Common;

namespace TanPms.Domain.Cashier;

public sealed class DepositLedger : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? StayId { get; set; }
    public Guid? LeaseId { get; set; }
    public Guid? ReservationId { get; set; }
    public required DepositType DepositType { get; set; }
    public List<DepositTransaction> Transactions { get; init; } = [];

    public decimal CurrentBalance =>
        Transactions.Where(t => t.TransactionType == DepositTransactionType.Received).Sum(t => t.Amount)
        - Transactions.Where(t => t.TransactionType != DepositTransactionType.Received).Sum(t => t.Amount);

    public DepositTransaction RecordReceipt(string documentNumber, decimal amount, CashierShift? cashShift = null, string? paymentMethod = null)
    {
        cashShift?.RecordCashDepositReceived(amount);
        var tx = new DepositTransaction
        {
            PropertyId = PropertyId,
            DepositLedgerId = Id,
            DocumentNumber = documentNumber,
            TransactionType = DepositTransactionType.Received,
            Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero),
            PaymentMethod = paymentMethod
        };
        Transactions.Add(tx);
        return tx;
    }

    public DepositTransaction RecordDeduction(string documentNumber, decimal amount, string reason)
    {
        var rounded = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        if (rounded > CurrentBalance)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Deduction amount cannot exceed current deposit balance.",
                httpStatus: 400);
        }

        var tx = new DepositTransaction
        {
            PropertyId = PropertyId,
            DepositLedgerId = Id,
            DocumentNumber = documentNumber,
            TransactionType = DepositTransactionType.DeductedForDamageOrUtility,
            Amount = rounded,
            Reason = reason
        };
        Transactions.Add(tx);
        return tx;
    }

    public DepositTransaction RefundRemainingBalance(string documentNumber, string reason, CashierShift? cashShift = null, string? paymentMethod = null)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Reason is required when refunding deposit balance.",
                httpStatus: 400);
        }

        var refundable = CurrentBalance;
        cashShift?.RecordCashDepositRefunded(refundable);
        var tx = new DepositTransaction
        {
            PropertyId = PropertyId,
            DepositLedgerId = Id,
            DocumentNumber = documentNumber,
            TransactionType = DepositTransactionType.Refunded,
            Amount = refundable,
            Reason = reason,
            PaymentMethod = paymentMethod
        };
        Transactions.Add(tx);
        return tx;
    }
}
