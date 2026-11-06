using TanPms.Domain.Common;

namespace TanPms.Domain.Operations;

public sealed class WorkOrder : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public Guid? ReportedByCustomerId { get; set; }
    public required string IssueSummary { get; set; }
    public string? BeforePhotoFileKey { get; set; }
    public string? AfterPhotoFileKey { get; set; }
    public decimal TenantChargeAmount { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Open;
}
