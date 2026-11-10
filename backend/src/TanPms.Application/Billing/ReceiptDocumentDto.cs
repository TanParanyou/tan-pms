using TanPms.Application.Common.Contracts;
using TanPms.Application.Stays;

namespace TanPms.Application.Billing;

// Invoice receipts print invoice lines; stay (folio) receipts print the folio charges instead.
public sealed record ReceiptDocumentDto(
    PropertyLetterheadDto Property,
    ReceiptItemDto Receipt,
    InvoiceItemDto? Invoice,
    IReadOnlyList<FolioChargeItemDto> FolioCharges);
