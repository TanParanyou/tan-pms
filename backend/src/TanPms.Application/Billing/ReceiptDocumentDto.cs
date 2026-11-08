using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record ReceiptDocumentDto(
    PropertyLetterheadDto Property,
    ReceiptItemDto Receipt,
    InvoiceItemDto Invoice);
