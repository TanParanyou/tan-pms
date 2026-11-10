using TanPms.Application.Cashier;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Leases;

// JSON-compatible superset of ReasonRequest: existing callers that send only "reason" keep working (refund defaults to Cash).
public sealed record CancelLeaseRequest(
    string Reason,
    string? RefundPaymentMethod = null)
{
    public Error? Validate() =>
        string.IsNullOrWhiteSpace(Reason)
            ? new Error(DomainErrorCodes.ValidationFailed, "Reason is required.")
            : RefundPaymentMethod is null ? null : PaymentMethods.Validate(RefundPaymentMethod);
}
