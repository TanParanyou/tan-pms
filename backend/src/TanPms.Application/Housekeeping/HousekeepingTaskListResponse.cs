using TanPms.Application.Common.Models;
namespace TanPms.Application.Housekeeping;

public sealed record HousekeepingTaskListResponse(
    IReadOnlyList<HousekeepingTaskDto> Items,
    PaginationMetadata? Pagination = null);
