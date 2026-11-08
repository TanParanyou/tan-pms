using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;

namespace TanPms.Application.Billing;

// Clients only ever see invoices that were issued; Drafts stay internal.
public static class ClientInvoiceRules
{
    public static bool IsVisible(Invoice invoice) => invoice.Status != InvoiceStatus.Draft;

    public static Error? ParseStatus(string? status, out InvoiceStatus? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        if (int.TryParse(status, out _)
            || !Enum.TryParse<InvoiceStatus>(status, ignoreCase: true, out var value)
            || !Enum.IsDefined(value)
            || value == InvoiceStatus.Draft)
        {
            return new Error(DomainErrorCodes.ValidationFailed, $"Invalid InvoiceStatus '{status}'.");
        }

        parsed = value;
        return null;
    }

    public static Error NotFound() =>
        new(DomainErrorCodes.PermissionDenied, "Invoice was not found for the current customer.");
}
