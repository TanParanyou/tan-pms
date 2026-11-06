namespace TanPms.Domain.Cashier;

public enum DepositTransactionType
{
    Received = 1,
    DeductedForDamageOrUtility = 2,
    Refunded = 3,
    Forfeited = 4
}
