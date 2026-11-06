import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectPillProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const SelectPill = React.forwardRef<HTMLSelectElement, SelectPillProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative inline-block w-full">
        <select
          ref={ref}
          className={cn(
            "flex h-10 w-full appearance-none items-center justify-between rounded-full border border-hairline bg-canvas px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors pr-10",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-body text-xs">
          ▼
        </span>
      </div>
    );
  }
);
SelectPill.displayName = "SelectPill";

export { SelectPill };
