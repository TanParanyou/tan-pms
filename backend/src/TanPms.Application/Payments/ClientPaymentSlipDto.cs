namespace TanPms.Application.Payments;

public sealed record ClientPaymentSlipDto(
    Guid Id,
    Guid PropertyId,
    Guid InvoiceId,
    string InvoiceDocumentNumber,
    decimal Amount,
    string? TransferReference,
    DateTimeOffset? TransferredAt,
    string SlipFileKey,
    string Status,
    DateTimeOffset SubmittedAt,
    string? RejectReason);
