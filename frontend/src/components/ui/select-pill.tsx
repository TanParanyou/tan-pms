import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectPillProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
  hasError?: boolean;
}

const SelectPill = React.forwardRef<HTMLSelectElement, SelectPillProps>(
  ({ className, wrapperClassName, hasError, children, ...props }, ref) => {
    const isInvalid = hasError || props["aria-invalid"] === true || props["aria-invalid"] === "true";

    return (
      <div className={cn("relative inline-block w-full", wrapperClassName)}>
        <select
          ref={ref}
          aria-invalid={isInvalid ? true : undefined}
          className={cn(
            "flex h-control min-h-control w-full appearance-none items-center justify-between rounded-full border bg-canvas px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors pr-8",
            isInvalid
              ? "border-destructive focus:ring-destructive/40"
              : "border-hairline focus:ring-focus-ring",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mute" />
      </div>
    );
  }
);
SelectPill.displayName = "SelectPill";

export { SelectPill };
