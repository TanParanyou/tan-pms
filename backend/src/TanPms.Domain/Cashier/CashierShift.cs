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
    public string? CancelReason { get; private set; }
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

    // Corrects a cash folio payment taken by mistake; the drawer total goes down by the reversed amount.
    public void ReverseCashReceipt(decimal amount)
    {
        EnsureOpen();
        CashReceiptsInShift -= decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
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

    public bool HasActivity =>
        CashReceiptsInShift != 0m || CashDepositsReceivedInShift != 0m || CashDepositsRefundedInShift != 0m;

    // Open -> Cancelled for a shift opened by mistake; frees the one-open-shift slot. Callers also check linked receipts.
    public void Cancel(string reason)
    {
        EnsureOpen();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Cancel reason is required.", httpStatus: 400);
        }

        if (HasActivity)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"CashierShift {DocumentNumber} has cash activity and must be closed instead of cancelled.",
                httpStatus: 400);
        }

        CancelReason = reason.Trim();
        Status = CashierShiftStatus.Cancelled;
    }

    public void UpdateVarianceRemark(string? varianceRemark)
    {
        if (Status != CashierShiftStatus.Closed)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Variance remark can only be edited on a Closed shift (current: {Status}).",
                httpStatus: 400);
        }

        if (CashVariance is not null and not 0m && string.IsNullOrWhiteSpace(varianceRemark))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Variance remark is required when the shift has a cash variance.",
                httpStatus: 400);
        }

        VarianceRemark = string.IsNullOrWhiteSpace(varianceRemark) ? null : varianceRemark.Trim();
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
