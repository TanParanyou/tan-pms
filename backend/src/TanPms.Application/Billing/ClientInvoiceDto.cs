using TanPms.Application.Payments;

namespace TanPms.Application.Billing;

// Client invoice with payment state nested so the client UI never joins receipts or slips itself.
public sealed record ClientInvoiceDto(
    InvoiceItemDto Invoice,
    decimal PaidAmount,
    decimal OutstandingAmount,
    IReadOnlyList<ReceiptItemDto> Receipts,
    IReadOnlyList<ClientPaymentSlipDto> Slips);
