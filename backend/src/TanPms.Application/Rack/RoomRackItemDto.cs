using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Rack;

public sealed record RoomRackItemDto(
    UnitRefDto Unit,
    string OccupancyStatus,
    string ConditionStatus,
    IReadOnlyList<string> SupportedStayModes,
    string? ActiveStayMode,
    string? ActiveDocumentNumber,
    CustomerRefDto? Customer,
    int? RemainingMinutes);
