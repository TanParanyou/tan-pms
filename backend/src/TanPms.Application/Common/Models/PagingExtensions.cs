namespace TanPms.Application.Common.Models;

public static class PagingExtensions
{
    // Works for EF (Count/Skip/Take are translated to SQL) and for in-memory sequences via AsQueryable().
    // The query must already be ordered so pages are stable.
    public static (List<T> Items, PaginationMetadata? Pagination) ToPage<T>(this IQueryable<T> orderedQuery, PageRequest? paging)
    {
        if (paging is null)
        {
            return (orderedQuery.ToList(), null);
        }

        var totalCount = orderedQuery.Count();
        var items = orderedQuery.Skip((paging.Page - 1) * paging.PageSize).Take(paging.PageSize).ToList();
        var totalPages = (int)Math.Ceiling(totalCount / (double)paging.PageSize);
        return (items, new PaginationMetadata(paging.Page, paging.PageSize, totalCount, totalPages));
    }
}
