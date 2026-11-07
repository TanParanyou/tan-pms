import { useState, useCallback, useMemo } from "react";
import { useDebouncedValue } from "./use-debounced-value";
import type { DataTableSortState } from "@/components/ui/data-table";

export interface UseDataTableStateOptions<TFilters extends Record<string, string>> {
  initialSearch?: string;
  initialFilters?: TFilters;
  initialSort?: DataTableSortState | null;
  initialPage?: number;
  initialPageSize?: number;
  debounceMs?: number;
}

export function useDataTableState<
  TFilters extends Record<string, string> = Record<string, string>
>(options: UseDataTableStateOptions<TFilters> = {}) {
  const {
    initialSearch = "",
    initialFilters = {} as TFilters,
    initialSort = null,
    initialPage = 1,
    initialPageSize = 20,
    debounceMs = 300,
  } = options;

  const [searchQuery, setSearchQueryState] = useState(initialSearch);
  const debouncedSearch = useDebouncedValue(searchQuery, debounceMs);

  const [filters, setFiltersState] = useState<TFilters>(initialFilters);
  const [sortState, setSortState] = useState<DataTableSortState | null>(initialSort);
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setPageState(1);
  }, []);

  const setFilter = useCallback((key: keyof TFilters, value: string) => {
    setFiltersState((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setSearchQueryState("");
    setPageState(1);
  }, [initialFilters]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const hasActiveFilters = useMemo(() => {
    if (searchQuery.trim().length > 0) return true;
    for (const [k, v] of Object.entries(filters)) {
      const initVal = initialFilters[k as keyof TFilters] ?? "";
      if (v !== initVal && v !== "" && v !== "all") {
        return true;
      }
    }
    return false;
  }, [searchQuery, filters, initialFilters]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    filters,
    setFilter,
    resetFilters,
    sortState,
    setSortState,
    page,
    setPage: setPageState,
    pageSize,
    setPageSize,
    selectedIds,
    setSelectedIds,
    clearSelection,
    hasActiveFilters,
  };
}
