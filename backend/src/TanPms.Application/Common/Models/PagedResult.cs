namespace TanPms.Application.Common.Models;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    PaginationMetadata Pagination);
