using TanPms.Domain.Common;

namespace TanPms.Application.Billing;

// In-app message sent once per invoice when it first becomes Overdue.
public static class InvoiceOverdueNotification
{
    public const string TemplateKey = "invoice.overdue";

    public static LocalizedText Title(string documentNumber) =>
        LocalizedText.Create($"ใบแจ้งหนี้ {documentNumber} เกินกำหนดชำระ", $"Invoice {documentNumber} is overdue");

    public static LocalizedText Body(string documentNumber, DateOnly dueDate, decimal totalAmount) =>
        LocalizedText.Create(
            $"ใบแจ้งหนี้ {documentNumber} ครบกำหนดวันที่ {dueDate:yyyy-MM-dd} ยอด {totalAmount:#,##0.00} บาท กรุณาชำระโดยเร็ว",
            $"Invoice {documentNumber} was due on {dueDate:yyyy-MM-dd} ({totalAmount:#,##0.00} THB). Please pay as soon as possible.",
            maxLength: 1000);
}
