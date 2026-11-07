import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, hasError, type, ...props }, ref) => {
    const isInvalid = hasError || props["aria-invalid"] === true || props["aria-invalid"] === "true";

    const inputElement = (
      <input
        type={type}
        aria-invalid={isInvalid ? true : undefined}
        className={cn(
          "flex h-control min-h-control w-full rounded-full border bg-canvas px-4 py-2 text-sm text-ink ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          isInvalid
            ? "border-destructive focus-visible:ring-destructive/40"
            : "border-hairline focus-visible:ring-focus-ring",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (wrapperClassName) {
      return <div className={cn("relative w-full", wrapperClassName)}>{inputElement}</div>;
    }

    return inputElement;
  }
);
Input.displayName = "Input";

export { Input };
