namespace TanPms.Application.Client;

public sealed record ClientUnpaidInvoiceDto(
    Guid Id,
    string DocumentNumber,
    decimal TotalAmount,
    string Status);
