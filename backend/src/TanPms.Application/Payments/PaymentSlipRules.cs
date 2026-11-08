using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;

namespace TanPms.Application.Payments;

// Shared slip rules so both persistence providers enforce the same checks.
public static class PaymentSlipRules
{
    public const string ClientSubmitActionKey = "client.payments.submit_slip";
    public const string ClientUpdateActionKey = "client.payments.update_slip";
    public const string ClientWithdrawActionKey = "client.payments.withdraw_slip";

    public static Error? ValidateSubmit(SubmitPaymentSlipRequest request) =>
        request.Amount <= 0m
            ? new Error(DomainErrorCodes.ValidationFailed, "Slip Amount must be greater than zero.")
            : string.IsNullOrWhiteSpace(request.SlipFileKey)
                ? new Error(DomainErrorCodes.ValidationFailed, "SlipFileKey is required.")
                : null;

    // Client may only pay its own invoice, while the invoice accepts payment, up to the outstanding amount.
    public static Error? CheckSubmittable(Invoice? invoice, Guid customerId, decimal outstanding, decimal amount)
    {
        if (invoice is null || invoice.CustomerId != customerId)
        {
            return new Error(DomainErrorCodes.PermissionDenied, "Invoice was not found for the current customer.");
        }

        if (!invoice.AcceptsPayment)
        {
            return new Error(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {invoice.DocumentNumber} in status {invoice.Status} cannot accept payments.");
        }

        return decimal.Round(amount, 2, MidpointRounding.AwayFromZero) > outstanding
            ? new Error(DomainErrorCodes.ValidationFailed, $"Slip amount cannot exceed outstanding balance ({outstanding:0.00}).")
            : null;
    }

    // Clients may only touch their own slip on the invoice in the route; anything else is reported as not found (403).
    public static Error? CheckClientOwnsSlip(PaymentSlip? slip, Guid customerId, Guid invoiceId) =>
        slip is null || slip.CustomerId != customerId || slip.InvoiceId != invoiceId
            ? new Error(DomainErrorCodes.PermissionDenied, "Payment slip was not found for the current customer.")
            : null;

    public static decimal Outstanding(Invoice invoice, IEnumerable<Receipt> invoiceReceipts) =>
        Math.Max(0m, invoice.TotalAmount - invoiceReceipts.Sum(r => r.NetPayableAmount));

    public static Error? ParseStatus(string? status, out PaymentSlipStatus? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        if (!Enum.TryParse<PaymentSlipStatus>(status, ignoreCase: true, out var value) || !Enum.IsDefined(value))
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid PaymentSlipStatus '{status}'.");
        }

        parsed = value;
        return null;
    }
}
