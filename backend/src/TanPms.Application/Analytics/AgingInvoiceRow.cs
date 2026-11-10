namespace TanPms.Application.Analytics;

// One open invoice as the aging report needs it: outstanding amount, property-local issue date and due date.
public sealed record AgingInvoiceRow(
    Guid CustomerId,
    decimal Outstanding,
    DateOnly IssueDate,
    DateOnly? DueDate);
