namespace TanPms.Application.WorkOrders;

public sealed record GetAdminWorkOrdersQuery(
    Guid PropertyId,
    string? Status);
