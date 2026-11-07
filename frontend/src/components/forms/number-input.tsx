"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberInputProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unitSuffix?: string;
  placeholder?: string;
  hasError?: boolean;
  id?: string;
  disabled?: boolean;
  wrapperClassName?: string;
  className?: string;
  "aria-label"?: string;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onValueChange,
      min,
      max,
      step = 1,
      decimals,
      unitSuffix,
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
    const formatValue = React.useCallback(
      (val: number) => {
        if (isNaN(val)) return "";
        if (decimals !== undefined) {
          return val.toFixed(decimals);
        }
        return String(val);
      },
      [decimals]
    );

    const [localValue, setLocalValue] = React.useState<string>(() =>
      value !== undefined && value !== null && !isNaN(value) ? formatValue(value) : ""
    );

    React.useEffect(() => {
      if (value !== undefined && value !== null && !isNaN(value)) {
        const parsedLocal = parseFloat(localValue);
        if (parsedLocal !== value) {
          setLocalValue(formatValue(value));
        }
      } else if (localValue !== "") {
        setLocalValue("");
      }
    }, [value, formatValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "" || raw === "-") {
        setLocalValue(raw);
        onValueChange(0);
        return;
      }

      // Check regex for numeric input
      const regex = decimals !== undefined && decimals === 0 ? /^-?\d*$/ : /^-?\d*(\.\d*)?$/;
      if (!regex.test(raw)) return;

      const num = parseFloat(raw);
      if (!isNaN(num)) {
        setLocalValue(raw);
        onValueChange(num);
      }
    };

    const handleBlur = () => {
      let num = parseFloat(localValue);
      if (isNaN(num)) {
        num = min !== undefined ? min : 0;
      }
      if (min !== undefined && num < min) {
        num = min;
      }
      if (max !== undefined && num > max) {
        num = max;
      }
      if (decimals !== undefined) {
        num = parseFloat(num.toFixed(decimals));
      }
      setLocalValue(formatValue(num));
      onValueChange(num);
    };

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode={decimals === 0 ? "numeric" : "decimal"}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          hasError={hasError}
          aria-label={ariaLabel}
          className={cn(
            "font-mono tabular-nums",
            unitSuffix ? "pr-14" : "",
            className
          )}
        />
        {unitSuffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-mute uppercase select-none">
            {unitSuffix}
          </span>
        )}
      </div>
    );
  }
);
NumberInput.displayName = "NumberInput";
