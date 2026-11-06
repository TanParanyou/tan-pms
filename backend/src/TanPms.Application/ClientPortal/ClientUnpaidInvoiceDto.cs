namespace TanPms.Application.ClientPortal;

public sealed record ClientUnpaidInvoiceDto(
    Guid Id,
    string DocumentNumber,
    decimal TotalAmount,
    string Status);
