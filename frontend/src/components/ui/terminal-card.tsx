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
        "rounded-[12px] border border-[#e5e5e5] bg-[#ffffff] shadow-none overflow-hidden font-mono text-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56] inline-block" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e] inline-block" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f] inline-block" />
          {title && (
            <span className="ml-2 text-xs font-semibold text-[#525252] tracking-wide">
              {title}
            </span>
          )}
        </div>
        {badge && (
          <span className="rounded-full bg-[#ffffff] border border-[#e5e5e5] px-2 py-0.5 text-[11px] text-[#737373]">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4 text-xs font-mono leading-relaxed text-[#090909]">
        {children}
      </div>
    </div>
  );
}
