"use client";

import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./table";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { SelectPill } from "./select-pill";
import { EmptyState } from "./empty-state";
import { MonoSpinner } from "./mono-spinner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

export interface ColumnDef<TData> {
  id?: string;
  header: React.ReactNode;
  cell?: (row: TData) => React.ReactNode;
  accessorKey?: keyof TData;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortValue?: (row: TData) => string | number | null | undefined;
  align?: "left" | "center" | "right";
}

export interface DataTableSortState {
  columnId: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  getRowId?: (row: TData, index: number) => string;
  sortState?: DataTableSortState | null;
  onSortChange?: (next: DataTableSortState | null) => void;
  enableRowSelection?: boolean;
  selectedRowIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  isRowSelectable?: (row: TData) => boolean;
  enablePagination?: boolean;
  page?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isZeroEntities?: boolean;
  zeroEntitiesTitle?: string;
  zeroEntitiesDescription?: string;
  zeroEntitiesAction?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  activeRowId?: string;
  density?: "compact" | "default" | "spacious";
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  emptyTitle,
  emptyDescription,
  className,
  getRowId,
  sortState,
  onSortChange,
  enableRowSelection = false,
  selectedRowIds,
  onSelectionChange,
  isRowSelectable,
  enablePagination = false,
  page,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  totalItems,
  onPageChange,
  onPageSizeChange,
  isZeroEntities = false,
  zeroEntitiesTitle,
  zeroEntitiesDescription,
  zeroEntitiesAction,
  onRowClick,
  activeRowId,
  density = "default",
}: DataTableProps<TData>) {
  const t = useTranslations("common");
  const colSpan = columns.length + (enableRowSelection ? 1 : 0);

  const resolvedEmptyTitle = emptyTitle || t("emptyFilterTitle");
  const resolvedEmptyDescription = emptyDescription || t("emptyFilterDescription");

  // Row ID resolver
  const resolveRowId = React.useCallback(
    (row: TData, index: number): string => {
      if (getRowId) return getRowId(row, index);
      if (row && typeof row === "object" && "id" in row) {
        const idVal = (row as Record<string, unknown>).id;
        if (idVal !== undefined && idVal !== null) return String(idVal);
      }
      return String(index);
    },
    [getRowId]
  );

  // Column map for O(1) lookup (zero .find())
  const colMap = React.useMemo(() => {
    const map = new Map<string, ColumnDef<TData>>();
    for (const col of columns) {
      const key = col.id || (col.accessorKey ? String(col.accessorKey) : "");
      if (key) map.set(key, col);
    }
    return map;
  }, [columns]);

  // Sorting state (controlled & uncontrolled)
  const [internalSortState, setInternalSortState] = React.useState<DataTableSortState | null>(null);
  const effectiveSortState = sortState !== undefined ? sortState : internalSortState;

  const handleSortToggle = (colId: string) => {
    let next: DataTableSortState | null = null;
    if (effectiveSortState?.columnId === colId) {
      if (effectiveSortState.direction === "asc") {
        next = { columnId: colId, direction: "desc" };
      } else {
        next = null;
      }
    } else {
      next = { columnId: colId, direction: "asc" };
    }

    if (sortState === undefined) {
      setInternalSortState(next);
    }
    onSortChange?.(next);
  };

  // Sort rows if uncontrolled
  const sortedData = React.useMemo(() => {
    if (!effectiveSortState) return data;
    const col = colMap.get(effectiveSortState.columnId);
    if (!col) return data;

    return [...data].sort((a, b) => {
      const aVal = col.sortValue
        ? col.sortValue(a)
        : col.accessorKey
        ? (a as Record<string, unknown>)[col.accessorKey as string]
        : undefined;
      const bVal = col.sortValue
        ? col.sortValue(b)
        : col.accessorKey
        ? (b as Record<string, unknown>)[col.accessorKey as string]
        : undefined;

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = aVal < bVal ? -1 : 1;
      return effectiveSortState.direction === "asc" ? cmp : -cmp;
    });
  }, [data, effectiveSortState, colMap]);

  // Pagination state (controlled & uncontrolled)
  const [internalPage, setInternalPage] = React.useState(1);
  const [internalPageSize, setInternalPageSize] = React.useState(20);
  const effectivePage = page !== undefined ? page : internalPage;
  const effectivePageSize = pageSize !== undefined ? pageSize : internalPageSize;
  const effectiveTotalItems = totalItems !== undefined ? totalItems : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotalItems / effectivePageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (page === undefined) setInternalPage(newPage);
    onPageChange?.(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    if (pageSize === undefined) setInternalPageSize(newSize);
    onPageSizeChange?.(newSize);
    if (page === undefined) setInternalPage(1);
    onPageChange?.(1);
  };

  const displayRows = React.useMemo(() => {
    if (!enablePagination || totalItems !== undefined) {
      return sortedData;
    }
    const start = (effectivePage - 1) * effectivePageSize;
    return sortedData.slice(start, start + effectivePageSize);
  }, [sortedData, enablePagination, totalItems, effectivePage, effectivePageSize]);

  // Selection state (controlled & uncontrolled)
  const [internalSelectedIds, setInternalSelectedIds] = React.useState<string[]>([]);
  const effectiveSelectedIds = selectedRowIds !== undefined ? selectedRowIds : internalSelectedIds;
  const selectedSet = React.useMemo(() => new Set(effectiveSelectedIds), [effectiveSelectedIds]);

  const updateSelection = (next: string[]) => {
    if (selectedRowIds === undefined) {
      setInternalSelectedIds(next);
    }
    onSelectionChange?.(next);
  };

  const selectableRows = React.useMemo(() => {
    return displayRows.filter((r) => (isRowSelectable ? isRowSelectable(r) : true));
  }, [displayRows, isRowSelectable]);

  const selectableRowIds = React.useMemo(() => {
    return selectableRows.map((r, i) => resolveRowId(r, i));
  }, [selectableRows, resolveRowId]);

  const selectedCountOnPage = React.useMemo(() => {
    return selectableRowIds.filter((id) => selectedSet.has(id)).length;
  }, [selectableRowIds, selectedSet]);

  const isAllSelected = selectableRowIds.length > 0 && selectedCountOnPage === selectableRowIds.length;
  const isSomeSelected = selectedCountOnPage > 0 && !isAllSelected;

  const handleHeaderCheckboxToggle = () => {
    if (isAllSelected) {
      const next = effectiveSelectedIds.filter((id) => !selectableRowIds.includes(id));
      updateSelection(next);
    } else {
      const next = Array.from(new Set([...effectiveSelectedIds, ...selectableRowIds]));
      updateSelection(next);
    }
  };

  const handleRowCheckboxToggle = (rowId: string, checked: boolean) => {
    const next = checked
      ? [...effectiveSelectedIds, rowId]
      : effectiveSelectedIds.filter((id) => id !== rowId);
    updateSelection(next);
  };

  // Density styles
  const densityCellPadding =
    density === "compact"
      ? "py-1.5 px-3"
      : density === "spacious"
      ? "py-3 px-4"
      : "py-2 px-3.5";

  // Zero Entities Onboarding State
  if (isZeroEntities && !isLoading && !isError) {
    return (
      <EmptyState
        title={zeroEntitiesTitle || resolvedEmptyTitle}
        description={zeroEntitiesDescription || resolvedEmptyDescription}
        className={className}
      >
        {zeroEntitiesAction}
      </EmptyState>
    );
  }

  const fromItem = effectiveTotalItems === 0 ? 0 : (effectivePage - 1) * effectivePageSize + 1;
  const toItem = Math.min(effectiveTotalItems, effectivePage * effectivePageSize);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {enableRowSelection && (
              <TableHead className="w-10 px-3 text-center">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                    onCheckedChange={handleHeaderCheckboxToggle}
                    aria-label={t("table.selectAll")}
                  />
                </div>
              </TableHead>
            )}

            {columns.map((col, idx) => {
              const colId = col.id || (col.accessorKey ? String(col.accessorKey) : String(idx));
              const isSorted = effectiveSortState?.columnId === colId;
              const sortDir = isSorted ? effectiveSortState.direction : null;
              const isRight = col.align === "right";
              const isCenter = col.align === "center";

              const headerContent = col.sortable ? (
                <button
                  type="button"
                  onClick={() => handleSortToggle(colId)}
                  className={cn(
                    "group inline-flex items-center gap-1.5 text-xs font-medium text-body hover:text-ink transition-colors",
                    isRight && "flex-row-reverse w-full text-right",
                    isCenter && "justify-center w-full text-center"
                  )}
                >
                  <span>{col.header}</span>
                  {sortDir === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5 text-ink shrink-0" />
                  ) : sortDir === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5 text-ink shrink-0" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-mute opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              ) : (
                col.header
              );

              return (
                <TableHead
                  key={colId}
                  aria-sort={
                    col.sortable
                      ? sortDir === "asc"
                        ? "ascending"
                        : sortDir === "desc"
                        ? "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "text-xs font-medium text-body",
                    isRight && "text-right font-mono tabular-nums",
                    isCenter && "text-center",
                    col.headerClassName
                  )}
                >
                  {headerContent}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-32 text-center text-xs text-body">
                <div className="flex items-center justify-center gap-2">
                  <MonoSpinner size="sm" />
                  <span>{t("loading")}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-32 text-center p-6 bg-destructive/5">
                <div role="alert" className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
                  <p className="text-xs font-semibold text-destructive">
                    {errorMessage || t("errors.generic")}
                  </p>
                  {onRetry && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      className="rounded-full text-xs h-8"
                    >
                      {t("retry")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-32 text-center p-6 text-body">
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Search className="h-5 w-5 text-mute" aria-hidden="true" />
                  <span className="text-xs font-semibold text-ink">{resolvedEmptyTitle}</span>
                  <span className="text-[11px] text-body">{resolvedEmptyDescription}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            displayRows.map((row, rowIdx) => {
              const rowId = resolveRowId(row, rowIdx);
              const isSelected = selectedSet.has(rowId);
              const isActive = activeRowId === rowId;
              const isSelectable = isRowSelectable ? isRowSelectable(row) : true;

              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-surface-soft/60 transition-colors",
                    isActive && "bg-surface-soft font-medium",
                    isSelected && "bg-surface-soft/40"
                  )}
                >
                  {enableRowSelection && (
                    <TableCell
                      className={cn("w-10 px-3 text-center", densityCellPadding)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          disabled={!isSelectable}
                          onCheckedChange={(checked) =>
                            handleRowCheckboxToggle(rowId, Boolean(checked))
                          }
                          aria-label={t("table.selectRow")}
                        />
                      </div>
                    </TableCell>
                  )}

                  {columns.map((col, colIdx) => {
                    let content: React.ReactNode = "-";
                    if (col.cell) {
                      content = col.cell(row);
                    } else if (col.accessorKey) {
                      const val = (row as Record<string, unknown>)[col.accessorKey as string];
                      content = val !== null && val !== undefined ? String(val) : "-";
                    }

                    const isRight = col.align === "right";
                    const isCenter = col.align === "center";

                    return (
                      <TableCell
                        key={col.id || String(col.accessorKey) || colIdx}
                        className={cn(
                          "text-xs text-ink",
                          densityCellPadding,
                          isRight && "text-right font-mono tabular-nums",
                          isCenter && "text-center",
                          col.className
                        )}
                      >
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination Footer */}
      {enablePagination && effectiveTotalItems > 0 && !isLoading && !isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2 text-xs text-body border-t border-hairline font-mono">
          <div className="flex items-center gap-2">
            <span>
              {t("table.showing")}{" "}
              <strong className="text-ink font-semibold tabular-nums">{fromItem}</strong>–
              <strong className="text-ink font-semibold tabular-nums">{toItem}</strong>{" "}
              {t("table.of")}{" "}
              <strong className="text-ink font-semibold tabular-nums">{effectiveTotalItems}</strong>{" "}
              {t("table.items")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-mute text-[11px] whitespace-nowrap">
                {t("table.rowsPerPage")}
              </span>
              <SelectPill
                value={String(effectivePageSize)}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 text-xs font-mono py-0 pl-2.5 pr-6 w-auto"
                aria-label={t("table.rowsPerPage")}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={String(opt)}>
                    {opt}
                  </option>
                ))}
              </SelectPill>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={effectivePage <= 1}
                onClick={() => handlePageChange(effectivePage - 1)}
                aria-label={t("table.previous")}
                className="h-8 w-8 rounded-full border-hairline text-ink disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="px-2 font-mono text-xs tabular-nums text-ink">
                {effectivePage} / {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={effectivePage >= totalPages}
                onClick={() => handlePageChange(effectivePage + 1)}
                aria-label={t("table.next")}
                className="h-8 w-8 rounded-full border-hairline text-ink disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
