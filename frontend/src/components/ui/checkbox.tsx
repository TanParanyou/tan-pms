import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      id,
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      onClick,
    },
    ref
  ) => {
    const isIndeterminate = checked === "indeterminate";
    const isChecked = checked === true;
    const dataState = isIndeterminate ? "indeterminate" : isChecked ? "checked" : "unchecked";
    const ariaChecked = isIndeterminate ? "mixed" : isChecked;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClick?.(e);
      if (disabled) return;
      onCheckedChange?.(isIndeterminate ? true : !isChecked);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        onCheckedChange?.(isIndeterminate ? true : !isChecked);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        id={id}
        disabled={disabled}
        aria-checked={ariaChecked}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-state={dataState}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-hairline-strong bg-canvas transition-colors",
          "data-[state=checked]:bg-ink data-[state=checked]:border-ink data-[state=checked]:text-canvas",
          "data-[state=indeterminate]:bg-ink data-[state=indeterminate]:border-ink data-[state=indeterminate]:text-canvas",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {isIndeterminate ? (
          <Minus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
        ) : isChecked ? (
          <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
        ) : null}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
