using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Rack;

public sealed record RoomRackResponse(
    PropertyRefDto Property,
    IReadOnlyList<RoomRackItemDto> Items);
