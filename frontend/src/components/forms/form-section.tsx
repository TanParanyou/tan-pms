"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function FormSection({
  title,
  description,
  headerAction,
  headerClassName,
  contentClassName,
  className,
  children,
  ...props
}: FormSectionProps) {
  const hasHeader = Boolean(title || description || headerAction);

  return (
    <div
      className={cn(
        "rounded-[12px] border border-hairline bg-canvas p-5 shadow-none space-y-4",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between border-b border-hairline pb-3 gap-2",
            headerClassName
          )}
        >
          <div className="space-y-0.5">
            {title && (
              <h3 className="text-sm font-semibold text-ink font-rounded">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-body">{description}</p>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">{headerAction}</div>
          )}
        </div>
      )}
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </div>
  );
}
