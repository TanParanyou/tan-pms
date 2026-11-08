namespace TanPms.Application.Billing;

public sealed record GetAdminReceiptsQuery(
    Guid PropertyId,
    Guid? InvoiceId);
