using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Payments;

public sealed record AdminPaymentSlipDto(
    Guid Id,
    Guid InvoiceId,
    string InvoiceDocumentNumber,
    string InvoiceStatus,
    decimal InvoiceTotalAmount,
    decimal InvoiceOutstandingAmount,
    CustomerRefDto Customer,
    UnitRefDto? Unit,
    decimal Amount,
    string? TransferReference,
    DateTimeOffset? TransferredAt,
    string SlipFileKey,
    string Status,
    DateTimeOffset SubmittedAt,
    string? ReviewedByUserId,
    DateTimeOffset? ReviewedAt,
    string? RejectReason,
    string? ReceiptDocumentNumber);
