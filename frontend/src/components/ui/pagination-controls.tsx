"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { SelectPill } from "./select-pill";

export interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** Accessible page controls shared by DataTable and non-table lists. */
export function PaginationControls({ page, pageSize, totalItems, pageSizeOptions, onPageChange, onPageSizeChange }: PaginationControlsProps) {
  const t = useTranslations("common");
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);

  return (
    <nav aria-label={t("table.pagination")} className="flex flex-wrap items-center justify-between gap-3 px-2 py-2 text-xs text-body border-t border-hairline font-mono">
      <span>
        {t("table.showing")} <strong className="text-ink font-semibold tabular-nums">{from}</strong>–
        <strong className="text-ink font-semibold tabular-nums">{to}</strong> {t("table.of")}{" "}
        <strong className="text-ink font-semibold tabular-nums">{totalItems}</strong> {t("table.items")}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-mute text-[11px] whitespace-nowrap">{t("table.rowsPerPage")}</span>
          <SelectPill
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
          <Button type="button" variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t("table.previous")} className="h-8 w-8 rounded-full border-hairline text-ink disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 font-mono text-xs tabular-nums text-ink" aria-live="polite">
            {page} / {totalPages}
          </span>
          <Button type="button" variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label={t("table.next")} className="h-8 w-8 rounded-full border-hairline text-ink disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
