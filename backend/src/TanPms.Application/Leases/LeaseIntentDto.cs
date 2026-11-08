using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Leases;

public sealed record LeaseIntentDto(
    Guid Id,
    Guid PropertyId,
    Guid LeaseId,
    string LeaseDocumentNumber,
    UnitRefDto Unit,
    CustomerRefDto Customer,
    string IntentType,
    DateOnly DesiredDate,
    string? Note,
    string Status,
    UserRefDto? ReviewedBy,
    DateTimeOffset? ReviewedAt,
    string? RejectReason,
    DateTimeOffset CreatedAt);
