using TanPms.Domain.Common;

namespace TanPms.Domain.Cashier;

public sealed class CashierShift : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required string CashierUserId { get; set; }
    public required decimal OpeningFloatCash { get; set; }
    public decimal CashReceiptsInShift { get; private set; }
    public decimal CashDepositsReceivedInShift { get; private set; }
    public decimal CashDepositsRefundedInShift { get; private set; }
    public decimal? ActualCashCounted { get; private set; }
    public decimal? ExpectedDrawerCash { get; private set; }
    public decimal? CashVariance { get; private set; }
    public string? VarianceRemark { get; private set; }
    public CashierShiftStatus Status { get; private set; } = CashierShiftStatus.Open;

    public void EnsureOpen()
    {
        if (Status != CashierShiftStatus.Open)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ShiftNotOpen,
                $"CashierShift {DocumentNumber} is {Status}; an Open shift is required.");
        }
    }

    public void RecordCashReceipt(decimal amount)
    {
        EnsureOpen();
        CashReceiptsInShift += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public void RecordCashDepositReceived(decimal amount)
    {
        EnsureOpen();
        CashDepositsReceivedInShift += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public void RecordCashDepositRefunded(decimal amount)
    {
        EnsureOpen();
        CashDepositsRefundedInShift += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public void CloseShift(decimal actualCashCounted, string? varianceRemark = null)
    {
        EnsureOpen();
        var reconciliation = CashierShiftReconciler.Reconcile(
            this,
            actualCashCounted,
            varianceRemark);

        ActualCashCounted = reconciliation.ActualCashCounted;
        ExpectedDrawerCash = reconciliation.ExpectedDrawerCash;
        CashVariance = reconciliation.CashVariance;
        VarianceRemark = varianceRemark;
        Status = CashierShiftStatus.Closed;
    }

    public void MarkReconciled()
    {
        if (Status != CashierShiftStatus.Closed)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "CashierShift must be Closed before it can be marked Reconciled.",
                httpStatus: 400);
        }

        Status = CashierShiftStatus.Reconciled;
    }
}
