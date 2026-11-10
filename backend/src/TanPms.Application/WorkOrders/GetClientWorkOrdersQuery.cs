namespace TanPms.Application.WorkOrders;

public sealed record GetClientWorkOrdersQuery(
    string? Status,
    int? Page = null,
    int? PageSize = null);
