using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Housekeeping;

public sealed record HousekeepingTaskDto(
    Guid Id,
    UnitRefDto Unit,
    string SourceDocumentNumber,
    string Status,
    string UnitConditionStatus,
    string? AssignedStaffUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
