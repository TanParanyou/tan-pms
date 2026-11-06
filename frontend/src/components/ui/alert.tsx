import * as React from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "danger" | "warning" | "success" | "info";

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
}

const variantConfig: Record<
  AlertVariant,
  {
    borderClass: string;
    bgClass: string;
    textClass: string;
    defaultIcon: string;
  }
> = {
  danger: {
    borderClass: "border-destructive/30",
    bgClass: "bg-destructive/10",
    textClass: "text-red-800",
    defaultIcon: "⚠️",
  },
  warning: {
    borderClass: "border-terminal-yellow/30",
    bgClass: "bg-terminal-yellow/10",
    textClass: "text-amber-800",
    defaultIcon: "⚡",
  },
  success: {
    borderClass: "border-terminal-green/30",
    bgClass: "bg-terminal-green/10",
    textClass: "text-emerald-800",
    defaultIcon: "✓",
  },
  info: {
    borderClass: "border-hairline",
    bgClass: "bg-surface-soft",
    textClass: "text-ink",
    defaultIcon: "ℹ️",
  },
};

export function Alert({
  variant = "info",
  title,
  icon,
  onClose,
  children,
  className,
  ...props
}: AlertProps) {
  const config = variantConfig[variant];

  return (
    <div
      role="alert"
      className={cn(
        "rounded-[12px] border p-4 text-xs flex items-start gap-3 transition-colors",
        config.borderClass,
        config.bgClass,
        config.textClass,
        className
      )}
      {...props}
    >
      <span className="text-base select-none shrink-0" aria-hidden="true">
        {icon || config.defaultIcon}
      </span>
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-semibold text-sm mb-0.5 tracking-tight">{title}</h4>
        )}
        <div className="leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 text-xs font-bold opacity-60 hover:opacity-100 transition-opacity p-0.5"
        >
          ✕
        </button>
      )}
    </div>
  );
}
