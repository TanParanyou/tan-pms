using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

// A receipt settles either an invoice (InvoiceId/InvoiceDocumentNumber) or a stay folio payment (StayId/StayDocumentNumber).
public sealed record ReceiptItemDto(
    Guid Id,
    string DocumentNumber,
    Guid? InvoiceId,
    string? InvoiceDocumentNumber,
    CustomerRefDto Customer,
    UnitRefDto? Unit,
    decimal InvoiceTotalAmount,
    decimal WithholdingTaxAmount,
    string? WhtCertificateNumber,
    decimal NetPayableAmount,
    bool IsCashPayment,
    DateTimeOffset IssuedAt,
    Guid? StayId = null,
    string? StayDocumentNumber = null,
    string? PaymentMethod = null);
