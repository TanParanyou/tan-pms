"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface ListToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ListToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
  className = "",
}: ListToolbarProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-canvas rounded-[12px] border border-hairline shadow-none ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 rounded-full pl-9 pr-4 text-xs bg-canvas"
          />
        </div>
        {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
