namespace TanPms.Application.Housekeeping;

public sealed record HousekeepingTaskListResponse(
    IReadOnlyList<HousekeepingTaskDto> Items);
