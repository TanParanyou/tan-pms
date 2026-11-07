using TanPms.Application.Common.Abstractions;

namespace TanPms.Application.Billing;

// Shared by the single and bulk issue handlers: audit + outbound customer notification per issued invoice.
public static class InvoiceIssueNotifier
{
    public static void RecordIssued(
        IAuditLogger auditLogger,
        INotificationSender notificationSender,
        Guid propertyId,
        string actionKey,
        InvoiceItemDto invoice)
    {
        auditLogger.RecordMutation(
            propertyId: propertyId,
            actionKey: actionKey,
            entityId: invoice.Id,
            reason: $"Issued invoice {invoice.DocumentNumber}",
            afterState: new { invoice.DocumentNumber, invoice.Status, invoice.TotalAmount });

        notificationSender.NotifyCustomerAsync(
            invoice.Customer.Id,
            InvoiceIssuedNotification.TemplateKey,
            new Dictionary<string, string>
            {
                ["channel"] = "InApp",
                ["document_number"] = invoice.DocumentNumber
            }).GetAwaiter().GetResult();
    }
}
