namespace TanPms.Application.Common.Models;

public sealed record PaginationMetadata(
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
