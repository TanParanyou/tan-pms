using TanPms.Application.Common.Results;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;

namespace TanPms.Application.Cashier;

// Shared request/filter validation so both persistence providers reject the same input.
public static class CashierRequestValidation
{
    public static Error? ValidateOpen(OpenCashierShiftRequest request) =>
        request.OpeningFloatCash < 0m
            ? new Error(DomainErrorCodes.ValidationFailed, "OpeningFloatCash cannot be negative.")
            : null;

    public static Error? ValidateClose(CloseCashierShiftRequest request) =>
        request.ActualCashCounted < 0m
            ? new Error(DomainErrorCodes.ValidationFailed, "ActualCashCounted cannot be negative.")
            : null;

    public static Error? ParseShiftStatus(string? status, out CashierShiftStatus? parsed) =>
        ParseEnum(status, "CashierShiftStatus", out parsed);

    public static Error? ParseDepositType(string? depositType, out DepositType? parsed) =>
        ParseEnum(depositType, "DepositType", out parsed);

    private static Error? ParseEnum<TEnum>(string? value, string name, out TEnum? parsed)
        where TEnum : struct, Enum
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!Enum.TryParse<TEnum>(value, ignoreCase: true, out var result) || !Enum.IsDefined(result))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid {name} '{value}'.");
        }

        parsed = result;
        return null;
    }
}
