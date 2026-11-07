"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { STAY_MODES, type StayModeType } from "@/constants/master-data";
import { cn } from "@/lib/utils";

export interface StayModeFilterPillsProps {
  selectedMode: string;
  onSelectMode: (mode: string) => void;
  includeAll?: boolean;
  className?: string;
}

export function StayModeFilterPills({
  selectedMode,
  onSelectMode,
  includeAll = true,
  className = "",
}: StayModeFilterPillsProps) {
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  return (
    <div
      role="group"
      aria-label="Filter by stay mode"
      className={cn("flex items-center gap-1.5 flex-wrap", className)}
    >
      {includeAll && (
        <Button
          type="button"
          variant={selectedMode === "All" ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectMode("All")}
          className={cn(
            "rounded-full text-xs font-mono h-8 px-3.5 shadow-none transition-colors",
            selectedMode === "All"
              ? "bg-ink text-canvas font-medium"
              : "border-hairline text-body hover:text-ink hover:bg-surface-soft"
          )}
        >
          {tCommon("viewAll")}
        </Button>
      )}

      {STAY_MODES.map((mode: StayModeType) => {
        const active = selectedMode === mode;
        return (
          <Button
            key={mode}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectMode(mode)}
            className={cn(
              "rounded-full text-xs font-mono h-8 px-3.5 shadow-none transition-colors",
              active
                ? "bg-ink text-canvas font-medium"
                : "border-hairline text-body hover:text-ink hover:bg-surface-soft"
            )}
          >
            {tModes(mode)}
          </Button>
        );
      })}
    </div>
  );
}
