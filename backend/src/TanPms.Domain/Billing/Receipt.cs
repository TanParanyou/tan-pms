using TanPms.Domain.Common;

namespace TanPms.Domain.Billing;

public sealed class Receipt : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid InvoiceId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? CashierShiftId { get; set; }
    public required decimal InvoiceTotalAmount { get; set; }
    public decimal WithholdingTaxAmount { get; set; }
    public string? WhtCertificateNumber { get; set; }
    public required decimal NetPayableAmount { get; set; }
    public bool IsCashPayment { get; set; }
}
