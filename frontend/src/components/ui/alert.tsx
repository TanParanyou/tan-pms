import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

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
    DefaultIcon: React.ComponentType<{ className?: string }>;
  }
> = {
  danger: {
    borderClass: "border-destructive/30",
    bgClass: "bg-destructive/10",
    textClass: "text-red-800",
    DefaultIcon: AlertCircle,
  },
  warning: {
    borderClass: "border-terminal-yellow/30",
    bgClass: "bg-terminal-yellow/10",
    textClass: "text-amber-800",
    DefaultIcon: AlertTriangle,
  },
  success: {
    borderClass: "border-terminal-green/30",
    bgClass: "bg-terminal-green/10",
    textClass: "text-emerald-800",
    DefaultIcon: CheckCircle2,
  },
  info: {
    borderClass: "border-hairline",
    bgClass: "bg-surface-soft",
    textClass: "text-ink",
    DefaultIcon: Info,
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
  const IconComponent = config.DefaultIcon;

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
      <span className="shrink-0 pt-0.5" aria-hidden="true">
        {icon || <IconComponent className="h-4 w-4" />}
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
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
