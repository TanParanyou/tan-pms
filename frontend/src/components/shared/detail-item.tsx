import React from "react";

export interface DetailItemProps {
  label: string;
  children: React.ReactNode;
}

/** Label + value pair used by detail views; renders "-" when there is nothing to show. */
export function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="break-words text-sm text-ink">{children ?? "-"}</div>
    </div>
  );
}
