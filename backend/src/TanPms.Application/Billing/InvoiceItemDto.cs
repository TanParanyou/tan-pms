using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record InvoiceItemDto(
    Guid Id,
    string DocumentNumber,
    string Status,
    string? BillingPeriodYearMonth,
    CustomerRefDto Customer,
    UnitRefDto? Unit,
    string? LeaseDocumentNumber,
    IReadOnlyList<InvoiceLineDto> Lines,
    decimal SubTotal,
    decimal TotalVatAmount,
    decimal TotalAmount,
    string? VoidReason,
    DateOnly? DueDate = null,
    DateTimeOffset? IssuedAt = null);
