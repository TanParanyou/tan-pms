using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Billing;

public static class BillingSettingsRules
{
    public const int MaxPaymentTermsDays = 365;

    public static Error? Validate(UpdateBillingSettingsRequest request) =>
        request.PaymentTermsDays is < 0 or > MaxPaymentTermsDays
            ? new Error(DomainErrorCodes.ValidationFailed, $"PaymentTermsDays must be between 0 and {MaxPaymentTermsDays}.")
            : null;
}
