import * as React from "react";
import { cn } from "@/lib/utils";

export interface TerminalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  badge?: string;
}

export function TerminalCard({
  className,
  title,
  badge,
  children,
  ...props
}: TerminalCardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-hairline bg-canvas shadow-none overflow-hidden font-mono text-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-hairline bg-surface-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-destructive inline-block" />
          <span className="h-3 w-3 rounded-full bg-terminal-yellow inline-block" />
          <span className="h-3 w-3 rounded-full bg-terminal-green inline-block" />
          {title && (
            <span className="ml-2 text-xs font-semibold text-charcoal tracking-wide">
              {title}
            </span>
          )}
        </div>
        {badge && (
          <span className="rounded-full bg-canvas border border-hairline px-2 py-0.5 text-[11px] text-body">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4 text-xs font-mono leading-relaxed text-ink-deep">
        {children}
      </div>
    </div>
  );
}
