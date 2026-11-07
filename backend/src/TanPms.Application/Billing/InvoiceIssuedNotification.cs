using TanPms.Domain.Common;

namespace TanPms.Application.Billing;

// In-app message persisted to the client feed when an invoice is issued.
public static class InvoiceIssuedNotification
{
    public const string TemplateKey = "invoice.issued";

    public static LocalizedText Title(string documentNumber) =>
        LocalizedText.Create($"ออกใบแจ้งหนี้ {documentNumber}", $"Invoice {documentNumber} issued");

    public static LocalizedText Body(string documentNumber, string? period, decimal totalAmount) =>
        LocalizedText.Create(
            $"ใบแจ้งหนี้ {documentNumber} รอบบิล {period ?? "-"} ยอดรวม {totalAmount:N2} บาท",
            $"Invoice {documentNumber} for period {period ?? "-"} totals THB {totalAmount:N2}",
            maxLength: 1000);
}
