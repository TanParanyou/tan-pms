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
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface ColumnDef<TData> {
  id?: string;
  header: React.ReactNode;
  cell?: (row: TData) => React.ReactNode;
  accessorKey?: keyof TData;
  className?: string;
  headerClassName?: string;
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
}: DataTableProps<TData>) {
  const t = useTranslations("common");
  const colSpan = columns.length;

  const resolvedEmptyTitle = emptyTitle || t("emptyFilterTitle");
  const resolvedEmptyDescription = emptyDescription || t("emptyFilterDescription");

  return (
    <div className={cn("w-full space-y-2", className)}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead
                key={col.id || String(col.accessorKey) || idx}
                className={cn("text-xs font-medium text-body", col.headerClassName)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-32 text-center text-xs text-body">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <span>{t("loading")}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-32 text-center p-6 bg-destructive/5">
                <div role="alert" className="flex flex-col items-center justify-center gap-2">
                  <span className="text-xl" aria-hidden="true">⚠️</span>
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
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className="text-lg" aria-hidden="true">🔍</span>
                  <span className="text-xs font-semibold text-ink">{resolvedEmptyTitle}</span>
                  <span className="text-[11px] text-body">{resolvedEmptyDescription}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {columns.map((col, colIdx) => {
                  let content: React.ReactNode = "-";
                  if (col.cell) {
                    content = col.cell(row);
                  } else if (col.accessorKey) {
                    const val = row[col.accessorKey];
                    content = val !== null && val !== undefined ? String(val) : "-";
                  }

                  return (
                    <TableCell
                      key={col.id || String(col.accessorKey) || colIdx}
                      className={cn("text-xs text-ink", col.className)}
                    >
                      {content}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
