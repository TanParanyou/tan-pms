using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record ReceiptItemDto(
    Guid Id,
    string DocumentNumber,
    Guid InvoiceId,
    string InvoiceDocumentNumber,
    CustomerRefDto Customer,
    UnitRefDto? Unit,
    decimal InvoiceTotalAmount,
    decimal WithholdingTaxAmount,
    string? WhtCertificateNumber,
    decimal NetPayableAmount,
    bool IsCashPayment,
    DateTimeOffset IssuedAt);
