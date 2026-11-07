"use client";

import React from "react";

export interface KpiItem {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  isAlert?: boolean;
}

export interface KpiSummaryStripProps {
  items: KpiItem[];
  className?: string;
}

export function KpiSummaryStrip({ items, className = "" }: KpiSummaryStripProps) {
  if (items.length === 0) return null;

  const colSpanClass =
    {
      1: "lg:grid-cols-1",
      2: "lg:grid-cols-2",
      3: "lg:grid-cols-3",
      4: "lg:grid-cols-4",
    }[Math.min(items.length, 4) as 1 | 2 | 3 | 4] ?? "lg:grid-cols-4";

  return (
    <div
      role="region"
      aria-label="KPI Metrics Summary"
      className={`rounded-[12px] border border-hairline bg-canvas divide-y sm:divide-y-0 sm:divide-x divide-hairline grid grid-cols-1 sm:grid-cols-2 ${colSpanClass} shadow-none ${className}`}
    >
      {items.map((item) => (
        <div key={item.id} className="p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-body font-medium">
            <span className="truncate">{item.label}</span>
            {item.icon && <div className="text-mute shrink-0">{item.icon}</div>}
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span
              className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${
                item.isAlert ? "text-destructive" : "text-ink"
              }`}
            >
              {item.value}
            </span>
            {item.badge && <div>{item.badge}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
