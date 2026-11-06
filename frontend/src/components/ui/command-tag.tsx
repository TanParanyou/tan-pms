import * as React from "react";
import { cn } from "@/lib/utils";

export interface CommandTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  prefixCode?: string;
}

export function CommandTag({
  className,
  prefixCode,
  children,
  ...props
}: CommandTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-soft px-3 py-1 font-mono text-[13px] font-medium text-ink tabular-nums tracking-tight shadow-none",
        className
      )}
      {...props}
    >
      {prefixCode && (
        <span className="text-body text-[11px] uppercase font-bold tracking-wider">
          {prefixCode}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}
