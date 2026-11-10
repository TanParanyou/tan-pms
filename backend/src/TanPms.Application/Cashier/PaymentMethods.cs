using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Cashier;

// Only Cash moves money through a cashier drawer; transfers are reconciled by slip/statement instead.
public static class PaymentMethods
{
    public const string Cash = "Cash";
    public const string BankTransfer = "BankTransfer";
    public const string PromptPay = "PromptPay";

    public static bool IsValid(string? method) => method is Cash or BankTransfer or PromptPay;

    public static Error? Validate(string? method) =>
        IsValid(method) ? null : new Error(DomainErrorCodes.ValidationFailed, $"Invalid PaymentMethod '{method}'.");
}
