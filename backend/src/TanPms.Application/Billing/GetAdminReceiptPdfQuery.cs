namespace TanPms.Application.Billing;

public sealed record GetAdminReceiptPdfQuery(
    Guid PropertyId,
    Guid ReceiptId);
