namespace TanPms.Application.WorkOrders;

public sealed record CreateWorkOrderRequest(
    Guid UnitId,
    string IssueSummary,
    string? Description = null,
    string? Priority = null,
    string? BeforePhotoFileKey = null);
