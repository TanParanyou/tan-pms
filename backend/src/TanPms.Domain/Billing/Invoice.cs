using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Billing;

public sealed class Invoice : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? StayId { get; set; }
    public Guid? LeaseId { get; set; }
    public List<InvoiceLine> Lines { get; init; } = [];
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public string? VoidReason { get; private set; }

    public decimal SubTotal => Lines.Sum(l => l.SubTotal);
    public decimal TotalVatAmount => Lines.Sum(l => l.VatAmount);
    public decimal TotalAmount => Lines.Sum(l => l.NetAmount);

    public void AddLine(LocalizedText description, decimal lineAmount, TaxMode taxMode)
    {
        EnsureMutable();
        var breakdown = ThaiTaxCalculator.CalculateLine(lineAmount, taxMode);
        Lines.Add(new InvoiceLine
        {
            Description = description,
            TaxMode = taxMode,
            LineAmount = breakdown.LineAmount,
            VatRate = breakdown.VatRate,
            SubTotal = breakdown.SubTotal,
            VatAmount = breakdown.VatAmount,
            NetAmount = breakdown.TotalAmount
        });
    }

    public void AddLine(string thaiDescription, decimal lineAmount, TaxMode taxMode, string? englishDescription = null) =>
        AddLine(LocalizedText.Create(thaiDescription, englishDescription), lineAmount, taxMode);

    public void Issue()
    {
        EnsureMutable();
        Status = InvoiceStatus.Issued;
    }

    public void MarkPaid()
    {
        if (Status == InvoiceStatus.Voided)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Voided invoice {DocumentNumber} cannot be paid.");
        }

        Status = InvoiceStatus.Paid;
    }

    public void EnsureCanDelete()
    {
        if (Status != InvoiceStatus.Draft)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {DocumentNumber} in status {Status} cannot be deleted. Use Void instead.");
        }
    }

    public AuditEvent Void(string reason)
    {
        if (Status == InvoiceStatus.Draft)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                "Draft invoice should be deleted rather than voided.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Void reason is required for audit logging.",
                httpStatus: 400);
        }

        var previousStatus = Status;
        Status = InvoiceStatus.Voided;
        VoidReason = reason;

        return new AuditEvent
        {
            PropertyId = PropertyId,
            ActionKey = "admin.invoice.void",
            EntityId = Id,
            Reason = reason,
            BeforeStateJson = $"{{\"status\":\"{previousStatus}\"}}",
            AfterStateJson = "{\"status\":\"Voided\"}"
        };
    }

    private void EnsureMutable()
    {
        if (Status != InvoiceStatus.Draft)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {DocumentNumber} is already in status {Status} and cannot be modified.");
        }
    }
}
