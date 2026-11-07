import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  wrapperClassName?: string;
  hasError?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, hasError, ...props }, ref) => {
    const isInvalid = hasError || props["aria-invalid"] === true || props["aria-invalid"] === "true";

    const textareaElement = (
      <textarea
        ref={ref}
        aria-invalid={isInvalid ? true : undefined}
        className={cn(
          "flex min-h-[80px] w-full rounded-[12px] border bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-mute shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-y",
          isInvalid
            ? "border-destructive focus-visible:ring-destructive/40"
            : "border-hairline focus-visible:ring-focus-ring",
          className
        )}
        {...props}
      />
    );

    if (wrapperClassName) {
      return (
        <div className={cn("relative w-full", wrapperClassName)}>
          {textareaElement}
        </div>
      );
    }

    return textareaElement;
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
