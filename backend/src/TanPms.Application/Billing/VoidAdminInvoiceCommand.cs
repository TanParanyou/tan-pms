using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record VoidAdminInvoiceCommand(
    Guid PropertyId,
    Guid InvoiceId,
    ReasonRequest Request);
