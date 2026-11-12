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
    public string? BillingPeriodYearMonth { get; set; }
    public List<InvoiceLine> Lines { get; init; } = [];
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public string? VoidReason { get; private set; }
    public DateTimeOffset? IssuedAt { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public DateTimeOffset? OverdueNotifiedAt { get; private set; }

    public decimal SubTotal => Lines.Sum(l => l.SubTotal);
    public decimal TotalVatAmount => Lines.Sum(l => l.VatAmount);
    public decimal TotalAmount => Lines.Sum(l => l.NetAmount);

    public InvoiceLine AddLine(
        LocalizedText description,
        decimal lineAmount,
        TaxMode taxMode,
        string? chargeCategoryCode = null,
        decimal vatRate = ThaiTaxCalculator.StandardThaiVatRate)
    {
        EnsureMutable();
        var line = BuildLine(description, lineAmount, taxMode, chargeCategoryCode, vatRate);
        Lines.Add(line);
        return line;
    }

    // Replaces a Draft line in place (new line id, same position, same charge category).
    public InvoiceLine ReplaceLine(
        Guid lineId,
        LocalizedText description,
        decimal lineAmount,
        TaxMode taxMode,
        decimal? vatRate = null)
    {
        EnsureMutable();
        var index = FindLineIndex(lineId);
        var resolvedVatRate = vatRate ?? (Lines[index].VatRate > 0m ? Lines[index].VatRate : ThaiTaxCalculator.StandardThaiVatRate);
        var line = BuildLine(description, lineAmount, taxMode, Lines[index].ChargeCategoryCode, resolvedVatRate);
        Lines[index] = line;
        return line;
    }

    public InvoiceLine RemoveLine(Guid lineId)
    {
        EnsureMutable();
        var index = FindLineIndex(lineId);
        var line = Lines[index];
        Lines.RemoveAt(index);
        return line;
    }

    public InvoiceLine AddLine(
        string thaiDescription,
        decimal lineAmount,
        TaxMode taxMode,
        string? englishDescription = null,
        string? chargeCategoryCode = null,
        decimal vatRate = ThaiTaxCalculator.StandardThaiVatRate) =>
        AddLine(LocalizedText.Create(thaiDescription, englishDescription), lineAmount, taxMode, chargeCategoryCode, vatRate);

    // dueDate is computed by the caller from the property's payment terms (property-local issue date + terms).
    public void Issue(DateTimeOffset? issuedAt = null, DateOnly? dueDate = null)
    {
        EnsureMutable();
        Status = InvoiceStatus.Issued;
        IssuedAt = issuedAt ?? DateTimeOffset.UtcNow;
        DueDate = dueDate;
    }

    public bool AcceptsPayment =>
        Status is InvoiceStatus.Issued or InvoiceStatus.Overdue or InvoiceStatus.PartiallyPaid;

    // totalPaidToDate = sum of all receipts applied to this invoice, including the new one.
    public void ApplyPayment(decimal totalPaidToDate)
    {
        if (!AcceptsPayment)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {DocumentNumber} in status {Status} cannot accept payments.");
        }

        Status = totalPaidToDate >= TotalAmount ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
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

    // Issued/PartiallyPaid past the due date become Overdue; idempotent. Returns true only when the status flipped.
    public bool MarkOverdueIfPastDue(DateOnly today)
    {
        if (Status is not (InvoiceStatus.Issued or InvoiceStatus.PartiallyPaid) || DueDate is not { } due || today <= due)
        {
            return false;
        }

        Status = InvoiceStatus.Overdue;
        return true;
    }

    // The client is told once per invoice, even if a partial payment later flips it back and forth.
    public bool TryMarkOverdueNotified(DateTimeOffset at)
    {
        if (Status != InvoiceStatus.Overdue || OverdueNotifiedAt.HasValue)
        {
            return false;
        }

        OverdueNotifiedAt = at;
        return true;
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

    private int FindLineIndex(Guid lineId)
    {
        var index = Lines.FindIndex(l => l.Id == lineId);
        return index >= 0
            ? index
            : throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Invoice line '{lineId}' was not found on invoice {DocumentNumber}.",
                httpStatus: 400);
    }

    private static InvoiceLine BuildLine(
        LocalizedText description,
        decimal lineAmount,
        TaxMode taxMode,
        string? chargeCategoryCode,
        decimal vatRate)
    {
        var breakdown = ThaiTaxCalculator.CalculateLine(lineAmount, taxMode, vatRate);
        return new InvoiceLine
        {
            Description = description,
            TaxMode = taxMode,
            LineAmount = breakdown.LineAmount,
            VatRate = breakdown.VatRate,
            SubTotal = breakdown.SubTotal,
            VatAmount = breakdown.VatAmount,
            NetAmount = breakdown.TotalAmount,
            ChargeCategoryCode = chargeCategoryCode
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
