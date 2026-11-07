"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: React.ReactNode;
  className?: string;
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  actions,
  className = "",
}: BulkActionToolbarProps) {
  const t = useTranslations("common");

  if (selectedCount <= 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions toolbar"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-ink text-canvas rounded-full shadow-lg border border-hairline font-mono text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-[13px] bg-canvas/20 px-2 py-0.5 rounded-full">
          {selectedCount}
        </span>
        <span className="text-canvas/80 text-[11px] uppercase tracking-wider">
          {t("selected")}
        </span>
      </div>

      <div className="h-4 w-[1px] bg-canvas/20" />

      <div className="flex items-center gap-2">{actions}</div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClearSelection}
        aria-label={t("clear")}
        className="rounded-full h-6 w-6 text-canvas/70 hover:text-canvas hover:bg-canvas/20 ml-1"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
