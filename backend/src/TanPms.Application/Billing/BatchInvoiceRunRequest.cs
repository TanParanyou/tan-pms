namespace TanPms.Application.Billing;

public sealed record BatchInvoiceRunRequest(
    string Period,
    Guid? BuildingId = null);
