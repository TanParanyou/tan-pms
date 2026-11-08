namespace TanPms.Application.WorkOrders;

public sealed record ResolveWorkOrderRequest(
    string ResolutionNotes,
    string? AfterPhotoFileKey = null,
    decimal RepairCostAmount = 0m,
    bool ChargeToTenant = false);
