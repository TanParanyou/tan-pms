"use client";

import { useCallback, useState } from "react";
import type { components } from "@/generated/api/tan-pms.v1";

export type PaginationMetadata = components["schemas"]["PaginationMetadata"];

export const PAGE_SIZE_OPTIONS: number[] = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Shared server-driven pagination state for DataTable lists.
 * The page snaps back to 1 whenever the `resetDeps` (filters / search) change, without an extra request
 * for the stale page, and is kept as-is after mutations.
 */
export function useServerPagination(resetDeps: readonly unknown[] = [], initialPageSize = DEFAULT_PAGE_SIZE) {
  const key = JSON.stringify(resetDeps);
  const [state, setState] = useState({ page: 1, pageSize: initialPageSize, key });
  const page = state.key === key ? state.page : 1;

  const setPage = useCallback((next: number) => setState((s) => ({ ...s, page: next, key })), [key]);
  const setPageSize = useCallback((size: number) => setState({ page: 1, pageSize: size, key }), [key]);

  /** Query params for the API call. */
  const paging = { page, pageSize: state.pageSize };

  /** Spread onto <DataTable>; pass the response `pagination` so totals drive the controls. */
  const tableProps = (pagination: PaginationMetadata | null | undefined) => ({
    enablePagination: true,
    page,
    pageSize: state.pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    totalItems: pagination?.totalCount,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  });

  return { page, pageSize: state.pageSize, paging, setPage, setPageSize, tableProps };
}
