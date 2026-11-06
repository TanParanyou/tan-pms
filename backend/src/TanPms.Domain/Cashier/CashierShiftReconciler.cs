using TanPms.Domain.Common;

namespace TanPms.Domain.Cashier;

public static class CashierShiftReconciler
{
    public static void EnsureOpenShiftAvailable(CashierShift? shift)
    {
        if (shift is null || shift.Status != CashierShiftStatus.Open)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift in the property before performing cash transactions.");
        }
    }

    public static CashierShiftReconciliationResult Reconcile(
        CashierShift shift,
        decimal actualCashCounted,
        string? varianceRemark = null)
    {
        EnsureOpenShiftAvailable(shift);

        var expectedDrawerCash = decimal.Round(
            shift.OpeningFloatCash
            + shift.CashReceiptsInShift
            + shift.CashDepositsReceivedInShift
            - shift.CashDepositsRefundedInShift,
            2,
            MidpointRounding.AwayFromZero);

        var roundedActual = decimal.Round(actualCashCounted, 2, MidpointRounding.AwayFromZero);
        var variance = roundedActual - expectedDrawerCash;

        if (variance != 0.00m && string.IsNullOrWhiteSpace(varianceRemark))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "A variance remark is required when ActualCashCounted differs from ExpectedDrawerCash.",
                httpStatus: 400);
        }

        return new CashierShiftReconciliationResult(expectedDrawerCash, roundedActual, variance);
    }
}
