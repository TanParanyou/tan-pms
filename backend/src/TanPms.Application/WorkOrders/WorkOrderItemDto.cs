using TanPms.Application.Common.Contracts;

namespace TanPms.Application.WorkOrders;

public sealed record WorkOrderItemDto(
    Guid Id,
    Guid PropertyId,
    string DocumentNumber,
    string Status,
    string Priority,
    UnitRefDto Unit,
    string IssueSummary,
    string? Description,
    CustomerRefDto? ReportedByCustomer,
    string? AssignedTechnicianUserId,
    string? BeforePhotoFileKey,
    string? AfterPhotoFileKey,
    string? ResolutionNotes,
    decimal TenantChargeAmount,
    string? ChargeDocumentNumber,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
