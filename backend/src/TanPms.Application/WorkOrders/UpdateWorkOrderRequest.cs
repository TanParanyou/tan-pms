namespace TanPms.Application.WorkOrders;

public sealed record UpdateWorkOrderRequest(
    string IssueSummary,
    string? Description = null,
    string? Priority = null,
    string? BeforePhotoFileKey = null);
