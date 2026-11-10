namespace TanPms.Application.Common.Models;

// Optional server-side paging. Absent page/pageSize = legacy "return everything" behaviour (null request).
public sealed record PageRequest(
    int Page,
    int PageSize)
{
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 200;

    public static PageRequest? From(int? page, int? pageSize) =>
        page is null && pageSize is null
            ? null
            : new PageRequest(Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize));
}
