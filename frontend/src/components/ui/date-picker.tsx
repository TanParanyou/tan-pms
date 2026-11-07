"use client";

import * as React from "react";
import { Input } from "./input";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateTimeInputProps {
  mode?: "date" | "datetime";
  value: string;
  onValueChange: (val: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  hasError?: boolean;
  id?: string;
  disabled?: boolean;
  wrapperClassName?: string;
  className?: string;
  "aria-label"?: string;
}

export const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  (
    {
      mode = "date",
      value,
      onValueChange,
      min,
      max,
      placeholder,
      hasError = false,
      id,
      disabled = false,
      wrapperClassName,
      className,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const inputType = mode === "datetime" ? "datetime-local" : "date";

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        <Input
          ref={ref}
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          min={min}
          max={max}
          placeholder={placeholder}
          hasError={hasError}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("font-mono tabular-nums pr-10", className)}
        />
        <Calendar className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mute" />
      </div>
    );
  }
);
DateTimeInput.displayName = "DateTimeInput";

export { DateTimeInput as DatePicker };
