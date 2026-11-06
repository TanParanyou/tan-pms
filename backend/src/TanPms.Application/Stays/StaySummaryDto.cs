using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record StaySummaryDto(
    Guid Id,
    string DocumentNumber,
    string StayMode,
    string Status,
    UnitRefDto Unit,
    CustomerRefDto Customer);
